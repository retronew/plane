import * as Y from "yjs";
import { env } from "@/env";
import { APIService } from "@/services/api.service";
import { onStateless } from "@/lib/stateless";
import { createIssueDescriptionServer, issueCodec, IssueEpochConflict } from "@/issue-description";
import type { IssueRepository, IssueSnapshot, IssueWrite, Options, IssueCodec } from "@/issue-description";

export const PAGE_DESCRIPTION_PATH = "/page-description/collaboration";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ROOM = new RegExp(`^plate-page:v1:([a-z0-9][a-z0-9-]{0,99}):(${UUID}):(0|[1-9][0-9]*)$`);
const PROJECT = new RegExp(`^${UUID}$`);
export function parsePageRoom(name: string) {
  const match = ROOM.exec(name);
  if (!match || !Number.isSafeInteger(Number(match[3]))) throw new Error("Invalid page description room");
  return { workspaceSlug: match[1], pageId: match[2], epoch: Number(match[3]) };
}
export function validatePageSnapshot(room: string, snapshot: IssueSnapshot) {
  const scope = parsePageRoom(room);
  if (!snapshot.can_read) throw Object.assign(new Error("Page access forbidden"), { statusCode: 403 });
  if (snapshot.epoch !== scope.epoch) throw new IssueEpochConflict();
  if (snapshot.format !== "slate-yjs-v1" || snapshot.schema_version !== 1 || snapshot.page_id !== scope.pageId)
    throw new Error("Unsupported page format");
}
export class PageDescriptionAPI extends APIService implements IssueRepository {
  private url(room: string, projectId?: string) {
    if (!projectId || !PROJECT.test(projectId)) throw new Error("Page project scope required");
    const { workspaceSlug, pageId } = parsePageRoom(room);
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/collaboration/`;
  }
  async read(room: string, cookie: string, projectId?: string): Promise<IssueSnapshot> {
    return (await this.get(this.url(room, projectId), { headers: { Cookie: cookie } })).data;
  }
  async write(
    room: string,
    cookie: string,
    payload: IssueWrite,
    initialize: boolean,
    projectId?: string
  ): Promise<IssueSnapshot> {
    const config = { headers: { Cookie: cookie, "live-server-secret-key": env.LIVE_SERVER_SECRET_KEY } };
    return (
      await (initialize
        ? this.post(this.url(room, projectId), payload, config)
        : this.patch(this.url(room, projectId), payload, config))
    ).data;
  }
}
export const pageCodec: IssueCodec = {
  seed(html, snapshot) {
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, issueCodec.seed(html));
      document.getText("title").insert(0, snapshot?.name ?? "");
      return Y.encodeStateAsUpdate(document);
    } finally {
      document.destroy();
    }
  },
  html: issueCodec.html,
  projection: (document) => ({ name: document.getText("title").toString() }),
};
export function createPageDescriptionServer(options: Options = {}) {
  return createIssueDescriptionServer({
    ...options,
    repository: options.repository ?? new PageDescriptionAPI(),
    codec: options.codec ?? pageCodec,
    validate: validatePageSnapshot,
    actor(headers, token) {
      const value: unknown = JSON.parse(token);
      if (
        !headers.cookie ||
        !value ||
        typeof value !== "object" ||
        !("id" in value) ||
        typeof value.id !== "string" ||
        !("projectId" in value) ||
        typeof value.projectId !== "string" ||
        !PROJECT.test(value.projectId)
      )
        throw new Error("Page session and project required");
      return { cookie: headers.cookie, userId: value.id, projectId: value.projectId };
    },
    onStateless,
  });
}
