import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingHttpHeaders } from "node:http";
import { fileURLToPath } from "node:url";
import { Hocuspocus } from "@hocuspocus/server";
import * as Y from "yjs";
import { APIService } from "@/services/api.service";
import { UserService } from "@/services/user.service";
import { env } from "@/env";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ROOM = new RegExp(`^plate-comparison:v1:([a-z0-9][a-z0-9-]{0,99}):(${UUID}):(${UUID})$`);
export const COMPARISON_PATH = "/editor-comparison/collaboration";
export const comparisonEnabled = () => process.env.NODE_ENV === "development";

export function parseComparisonRoom(name: string) {
  const match = ROOM.exec(name);
  if (!match) throw new Error("Invalid comparison room");
  return { workspaceSlug: match[1], projectId: match[2], roomId: match[3] };
}

class ComparisonMembershipService extends APIService {
  async member(cookie: string, workspaceSlug: string, projectId: string) {
    const response = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/project-members/me/`, {
      headers: { Cookie: cookie },
    });
    return response.data as { member: { id: string }; project: { id: string }; role: number; is_active: boolean };
  }
}

type AuthInput = {
  documentName: string;
  token: string;
  requestHeaders: IncomingHttpHeaders;
  requestParameters: URLSearchParams;
};

export async function authenticateComparison(input: AuthInput) {
  const room = parseComparisonRoom(input.documentName);
  if (
    input.requestParameters.get("workspaceSlug") !== room.workspaceSlug ||
    input.requestParameters.get("projectId") !== room.projectId
  )
    throw new Error("Comparison room scope mismatch");
  const origins = comparisonOrigins();
  if (!input.requestHeaders.origin || !origins.includes(input.requestHeaders.origin)) {
    throw new Error("Comparison origin forbidden");
  }
  const token: unknown = JSON.parse(input.token);
  if (!token || typeof token !== "object" || !("id" in token) || typeof token.id !== "string") {
    throw new Error("Invalid comparison credentials");
  }
  // Browser session only: never accept a client-supplied cookie in the token or query string.
  return authorizeComparisonRoom(input.documentName, input.requestHeaders.cookie, token.id);
}

export function comparisonOrigins() {
  const origins = env.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : ["http://localhost:3000", "http://127.0.0.1:3000"];
}

export async function authorizeComparisonRoom(documentName: string, cookie?: string, userId?: string) {
  const room = parseComparisonRoom(documentName);
  if (!cookie) throw new Error("Comparison session required");
  const user = await new UserService().currentUser(cookie);
  if (userId !== undefined && user.id !== userId) throw new Error("Comparison user mismatch");
  const member = await new ComparisonMembershipService().member(cookie, room.workspaceSlug, room.projectId);
  if (
    member.member?.id !== user.id ||
    member.project?.id !== room.projectId ||
    member.is_active !== true ||
    ![15, 20].includes(member.role)
  )
    throw new Error("Comparison project membership forbidden");
  return { user: { id: user.id, name: user.display_name }, ...room };
}

/** One local development live process owns this directory; it is not a multi-server database. */
export class ComparisonStore {
  private pending = new Map<string, Promise<unknown>>();
  constructor(private directory: string) {}

  private path(room: string) {
    parseComparisonRoom(room);
    return join(this.directory, `${createHash("sha256").update(room).digest("hex")}.yjs`);
  }

  private async exclusive<T>(room: string, work: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(room) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    this.pending.set(room, current);
    try {
      return await current;
    } finally {
      if (this.pending.get(room) === current) this.pending.delete(room);
    }
  }

  private async write(path: string, state: Uint8Array) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, state, { mode: 0o600, flag: "wx" });
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }

  async load(room: string): Promise<Uint8Array> {
    const path = this.path(room);
    return this.exclusive(room, async () => {
      try {
        return await readFile(path);
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      }
      const document = new Y.Doc();
      try {
        // Exactly one canonical empty Slate paragraph, before any client can normalize.
        document.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText(), attributes: { type: "p" } }]);
        document.getMap("comparison").set("schema", 1);
        const state = Y.encodeStateAsUpdate(document);
        await this.write(path, state);
        return state;
      } finally {
        document.destroy();
      }
    });
  }

  async save(room: string, state: Uint8Array) {
    const path = this.path(room);
    return this.exclusive(room, () => this.write(path, state));
  }
}

export function createComparisonServer() {
  if (!comparisonEnabled()) return undefined;
  // Works from src (tests) and dist (tsdown output), independent of the shell cwd.
  const store = new ComparisonStore(fileURLToPath(new URL("../.editor-comparison-data/", import.meta.url)));
  return new Hocuspocus({
    name: "editor-comparison-development",
    debounce: 250,
    maxDebounce: 1000,
    onAuthenticate: authenticateComparison,
    async onLoadDocument({ documentName, document }) {
      Y.applyUpdate(document, await store.load(documentName));
    },
    async onStoreDocument({ documentName, document }) {
      await store.save(documentName, Y.encodeStateAsUpdate(document));
    },
  });
}
