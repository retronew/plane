/* eslint-disable no-await-in-loop -- CAS retries and per-connection permission checks must complete in order. */
import type { IncomingHttpHeaders } from "node:http";
import { Hocuspocus } from "@hocuspocus/server";
import type { Document, onAuthenticatePayload } from "@hocuspocus/server";
import * as Y from "yjs";
import { htmlToSlate, slateToHtml, slateNodesToInsertDelta, yTextToSlateElement } from "@plane/editor/plate-headless";
import type { SlateNode } from "@plane/editor/plate-headless";
import { env } from "@/env";
import { APIService } from "@/services/api.service";
import { UserService } from "@/services/user.service";

export const ISSUE_DESCRIPTION_PATH = "/issue-description/collaboration";
const FORMAT = "slate-yjs-v1";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ROOM = new RegExp(`^plate-issue:v1:([a-z0-9][a-z0-9-]{0,99}):(${UUID}):(${UUID}):(0|[1-9][0-9]*)$`);
const REMOTE = Symbol("issue-description-api");

export function parseIssueRoom(name: string) {
  const match = ROOM.exec(name);
  if (!match || !Number.isSafeInteger(Number(match[4]))) throw new Error("Invalid issue description room");
  return { workspaceSlug: match[1], projectId: match[2], issueId: match[3], epoch: Number(match[4]) };
}
export type IssueSnapshot = {
  format: string;
  schema_version: number;
  epoch: number;
  revision: number;
  state: string | null;
  description_html: string;
  source_hash: string;
  can_read: boolean;
  can_edit: boolean;
  issue_id?: string;
  page_id?: string;
  name?: string;
};
export type IssueWrite = {
  format: string;
  epoch: number;
  revision: number;
  state: string;
  source_hash?: string;
  description_html?: string;
  contributors?: string[];
  name?: string;
};
export interface IssueRepository {
  read(room: string, cookie: string, projectId?: string): Promise<IssueSnapshot>;
  write(
    room: string,
    cookie: string,
    payload: IssueWrite,
    initialize: boolean,
    projectId?: string
  ): Promise<IssueSnapshot>;
}
export class IssueDescriptionAPI extends APIService implements IssueRepository {
  private url(room: string) {
    const { workspaceSlug, projectId, issueId } = parseIssueRoom(room);
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/collaboration/`;
  }
  async read(room: string, cookie: string): Promise<IssueSnapshot> {
    return (await this.get(this.url(room), { headers: { Cookie: cookie } })).data;
  }
  async write(room: string, cookie: string, payload: IssueWrite, initialize: boolean): Promise<IssueSnapshot> {
    const config = { headers: { Cookie: cookie, "live-server-secret-key": env.LIVE_SERVER_SECRET_KEY } };
    return (
      await (initialize ? this.post(this.url(room), payload, config) : this.patch(this.url(room), payload, config))
    ).data;
  }
}
export interface IssueCodec {
  seed(html: string, snapshot?: IssueSnapshot): Uint8Array;
  projection?(document: Y.Doc): Partial<IssueWrite>;
  html(document: Y.Doc): string;
}
function isSlateNode(value: unknown, depth = 0): value is SlateNode {
  if (depth > 100 || !value || typeof value !== "object") return false;
  if ("text" in value) return typeof value.text === "string";
  return (
    "type" in value &&
    typeof value.type === "string" &&
    "children" in value &&
    Array.isArray(value.children) &&
    value.children.every((child) => isSlateNode(child, depth + 1))
  );
}
export const issueCodec: IssueCodec = {
  seed(html) {
    const doc = new Y.Doc();
    try {
      doc.get("content", Y.XmlText).applyDelta(slateNodesToInsertDelta(htmlToSlate(html)));
      return Y.encodeStateAsUpdate(doc);
    } finally {
      doc.destroy();
    }
  },
  html(doc) {
    const children: unknown[] = yTextToSlateElement(doc.get("content", Y.XmlText)).children;
    if (!children.every((child): child is SlateNode => isSlateNode(child))) throw new Error("Invalid Slate document");
    return slateToHtml(children);
  },
};
export type Actor = { cookie: string; userId: string; projectId?: string };
type RoomState = {
  snapshot: IssueSnapshot;
  actors: Map<string, Actor>;
  reader: Actor;
  lastWriter?: Actor;
  pending: Promise<unknown>;
  fenced: boolean;
};
const status = (error: unknown) => (error as { statusCode?: number })?.statusCode;
export class IssueEpochConflict extends Error {
  constructor() {
    super("Issue description changed externally; reload required");
  }
}
function checkSnapshot(room: string, snapshot: IssueSnapshot) {
  const scope = parseIssueRoom(room);
  if (!snapshot.can_read) throw Object.assign(new Error("Issue description access forbidden"), { statusCode: 403 });
  if (snapshot.epoch !== scope.epoch) throw new IssueEpochConflict();
  if (snapshot.format !== FORMAT || snapshot.schema_version !== 1 || snapshot.issue_id !== scope.issueId) {
    throw new Error("Unsupported issue description format");
  }
}

/** API CAS is the shared authority. Never merge independently generated initial documents. */
export class IssueDescriptionStore {
  private rooms = new WeakMap<Y.Doc, RoomState>();
  constructor(
    private repository: IssueRepository,
    private codec: IssueCodec = issueCodec,
    private validate = checkSnapshot
  ) {}

  async load(room: string, document: Y.Doc, actor: Actor) {
    let snapshot = await this.repository.read(room, actor.cookie, actor.projectId);
    for (let attempt = 0; attempt < 5; attempt++) {
      this.validate(room, snapshot);
      if (snapshot.state !== null) {
        Y.applyUpdate(document, Buffer.from(snapshot.state, "base64"), REMOTE);
        this.rooms.set(document, {
          snapshot,
          actors: new Map(),
          reader: actor,
          pending: Promise.resolve(),
          fenced: false,
        });
        return;
      }
      try {
        snapshot = await this.repository.write(
          room,
          actor.cookie,
          {
            format: FORMAT,
            epoch: snapshot.epoch,
            revision: snapshot.revision,
            source_hash: snapshot.source_hash,
            state: Buffer.from(this.codec.seed(snapshot.description_html, snapshot)).toString("base64"),
          },
          true,
          actor.projectId
        );
      } catch (error) {
        if (status(error) !== 409) throw error;
        snapshot = await this.repository.read(room, actor.cookie, actor.projectId);
      }
    }
    throw new Error("Issue description initialization contention");
  }
  changed(document: Y.Doc, actor: Actor) {
    const state = this.rooms.get(document);
    if (!state || state.fenced) return;
    state.actors.set(actor.userId, actor);
    state.lastWriter = actor;
  }
  reader(document: Y.Doc, actor: Actor) {
    const state = this.rooms.get(document);
    if (state && !state.actors.size) {
      state.reader = actor;
      state.lastWriter = undefined;
    }
  }
  snapshot(document: Y.Doc) {
    return this.rooms.get(document)?.snapshot;
  }
  hasPending(document: Y.Doc) {
    return !!this.rooms.get(document)?.actors.size;
  }
  isFenced(document: Y.Doc) {
    return this.rooms.get(document)?.fenced === true;
  }
  fence(document: Y.Doc) {
    const state = this.rooms.get(document);
    if (state) state.fenced = true;
  }

  async synchronize(room: string, document: Y.Doc) {
    const state = this.rooms.get(document);
    if (!state || state.fenced) return;
    const work = state.pending
      .catch(() => {})
      .then(async () => {
        if (state.fenced) return;
        for (let attempt = 0; attempt < 5; attempt++) {
          const actor = state.lastWriter ?? state.reader;
          const snapshot = await this.repository.read(room, actor.cookie, actor.projectId);
          this.validate(room, snapshot);
          if (snapshot.state === null) throw new IssueEpochConflict();
          Y.applyUpdate(document, Buffer.from(snapshot.state, "base64"), REMOTE);
          state.snapshot = snapshot;
          if (!state.actors.size) return;
          if (!snapshot.can_edit)
            throw Object.assign(new Error("Issue description editing forbidden"), { statusCode: 403 });
          const actors = new Map(state.actors);
          const payload: IssueWrite = {
            format: FORMAT,
            epoch: snapshot.epoch,
            revision: snapshot.revision,
            state: Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64"),
            description_html: this.codec.html(document),
            contributors: [...actors.keys()],
            ...this.codec.projection?.(document),
          };
          const writer = state.lastWriter ?? actor;
          for (const contributor of actors.values()) {
            const permission = await this.repository.read(room, contributor.cookie, contributor.projectId);
            this.validate(room, permission);
            if (!permission.can_edit)
              throw Object.assign(new Error("Contributor editing forbidden"), { statusCode: 403 });
          }
          try {
            state.snapshot = await this.repository.write(room, writer.cookie, payload, false, writer.projectId);
            for (const [id, contribution] of actors) {
              if (state.actors.get(id) === contribution) state.actors.delete(id);
            }
            return;
          } catch (error) {
            if (status(error) !== 409) throw error;
          }
        }
        throw new Error("Issue description save contention");
      });
    state.pending = work;
    return work;
  }
}

export type Options = {
  validate?: typeof checkSnapshot;
  actor?: (headers: IncomingHttpHeaders, token: string) => Actor;
  onStateless?: import("@hocuspocus/server").Configuration["onStateless"];
  repository?: IssueRepository;
  codec?: IssueCodec;
  pollInterval?: number;
  currentUser?: (cookie: string) => Promise<{ id: string; display_name: string }>;
  origins?: string[];
};
function credentials(headers: IncomingHttpHeaders, token: string): Actor {
  const parsed: unknown = JSON.parse(token);
  if (!headers.cookie || !parsed || typeof parsed !== "object" || !("id" in parsed) || typeof parsed.id !== "string") {
    throw new Error("Issue description session required");
  }
  return { cookie: headers.cookie, userId: parsed.id };
}
export function createIssueDescriptionServer(options: Options = {}) {
  const repository = options.repository ?? new IssueDescriptionAPI();
  const validate = options.validate ?? checkSnapshot;
  const store = new IssueDescriptionStore(repository, options.codec, validate);
  const currentUser = options.currentUser ?? ((cookie: string) => new UserService().currentUser(cookie));
  const origins =
    options.origins ??
    env.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  const authorization = new WeakMap<object, { until: number; snapshot: IssueSnapshot }>();
  const invalidate = (document: Document) => {
    store.fence(document);
    document.broadcastStateless(JSON.stringify({ type: "fenced", reason: "version-or-permission-changed" }));
    for (const connection of document.getConnections()) {
      connection.readOnly = true;
      connection.close({ code: 4409, reason: "Issue description reload required" });
    }
  };
  const synchronize = async (documentName: string, document: Document) => {
    try {
      for (const connection of document.getConnections()) {
        try {
          const snapshot = await repository.read(
            documentName,
            (connection.context as Actor).cookie,
            (connection.context as Actor).projectId
          );
          validate(documentName, snapshot);
          connection.readOnly = !snapshot.can_edit;
          store.reader(document, connection.context as Actor);
        } catch (error) {
          if (error instanceof IssueEpochConflict) throw error;
          if ([401, 403, 404].includes(status(error) ?? 0)) {
            connection.readOnly = true;
            connection.sendStateless(JSON.stringify({ type: "fenced", reason: "permission-changed" }));
            connection.close({ code: 4403, reason: "Issue description access revoked" });
          } else throw error;
        }
      }
      const previous = store.snapshot(document)?.revision;
      await store.synchronize(documentName, document);
      const snapshot = store.snapshot(document);
      if (!store.isFenced(document) && !store.hasPending(document) && snapshot && snapshot.revision !== previous) {
        document.broadcastStateless(
          JSON.stringify({ type: "saved", epoch: snapshot.epoch, revision: snapshot.revision })
        );
      }
    } catch (error) {
      if (error instanceof IssueEpochConflict || [401, 403, 404].includes(status(error) ?? 0)) {
        invalidate(document);
        return;
      }
      // Retain unsaved state in memory; the next poll retries transient API failures.
      document.broadcastStateless(JSON.stringify({ type: "save-error" }));
      throw error;
    }
  };
  return new Hocuspocus({
    name: "issue-description-slate-v1",
    ...(options.onStateless ? { onStateless: options.onStateless } : {}),
    debounce: 250,
    maxDebounce: 1000,
    async onAuthenticate({ documentName, token, requestHeaders, connection }: onAuthenticatePayload) {
      if (!requestHeaders.origin || !origins.includes(requestHeaders.origin))
        throw new Error("Issue description origin forbidden");
      const actor = (options.actor ?? credentials)(requestHeaders, token);
      const user = await currentUser(actor.cookie);
      if (user.id !== actor.userId) throw new Error("Issue description user mismatch");
      const snapshot = await repository.read(documentName, actor.cookie, actor.projectId);
      validate(documentName, snapshot);
      connection.readOnly = !snapshot.can_edit;
      return { ...actor, user: { id: user.id, name: user.display_name } };
    },
    async connected({ documentName, instance, connectionInstance }) {
      const document = instance.documents.get(documentName);
      const snapshot = document && store.snapshot(document);
      if (document && snapshot && !store.hasPending(document) && !store.isFenced(document)) {
        connectionInstance.sendStateless(
          JSON.stringify({ type: "saved", epoch: snapshot.epoch, revision: snapshot.revision })
        );
      }
    },
    async onLoadDocument({ documentName, document, context }) {
      await store.load(documentName, document, context as Actor);
    },
    async afterLoadDocument({ documentName, document }) {
      const timer = setInterval(() => {
        void synchronize(documentName, document).catch(() => {});
      }, options.pollInterval ?? 2000);
      timer.unref();
      timers.set(documentName, timer);
    },
    async beforeHandleMessage({ documentName, document, context, connection }) {
      if (store.isFenced(document)) throw new IssueEpochConflict();
      try {
        const cached = authorization.get(connection);
        const snapshot =
          cached && cached.until > Date.now()
            ? cached.snapshot
            : await repository.read(documentName, (context as Actor).cookie, (context as Actor).projectId);
        authorization.set(connection, {
          until: cached && cached.snapshot === snapshot ? cached.until : Date.now() + 500,
          snapshot,
        });
        validate(documentName, snapshot);
        connection.readOnly = !snapshot.can_edit;
      } catch (error) {
        connection.readOnly = true;
        if (error instanceof IssueEpochConflict) invalidate(document);
        throw error;
      }
    },
    async onChange({ document, context, transactionOrigin }) {
      if (transactionOrigin !== REMOTE && context?.userId) {
        store.changed(document, { ...context } as Actor);
        document.broadcastStateless(JSON.stringify({ type: "pending" }));
      }
    },
    async onStoreDocument({ documentName, document }) {
      await synchronize(documentName, document);
    },
    async afterUnloadDocument({ documentName }) {
      clearInterval(timers.get(documentName));
      timers.delete(documentName);
    },
    async onDestroy() {
      for (const timer of timers.values()) clearInterval(timer);
      timers.clear();
    },
  });
}
