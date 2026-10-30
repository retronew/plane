import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createPageDescriptionServer, pageCodec, parsePageRoom, validatePageSnapshot } from "@/page-description";
import { IssueDescriptionStore } from "@/issue-description";
import type { IssueRepository, IssueSnapshot, IssueWrite } from "@/issue-description";
vi.mock("@/env", () => ({ env: { CORS_ALLOWED_ORIGINS: "https://plane.test" } }));
const pageId = "22222222-2222-4222-8222-222222222222";
const projectId = "11111111-1111-4111-8111-111111111111";
const otherProject = "33333333-3333-4333-8333-333333333333";
const room = `plate-page:v1:workspace:${pageId}:0`;
function fixture() {
  let snapshot: IssueSnapshot = {
    format: "slate-yjs-v1",
    schema_version: 1,
    page_id: pageId,
    epoch: 0,
    revision: 0,
    state: null,
    description_html: "<p>body</p>",
    name: "Page title",
    source_hash: "hash",
    can_read: true,
    can_edit: true,
  };
  const scopes: (string | undefined)[] = [];
  const repository: IssueRepository = {
    async read(_room, _cookie, project) {
      scopes.push(project);
      return { ...snapshot };
    },
    async write(_room, _cookie, payload: IssueWrite, _initialize, project) {
      scopes.push(project);
      if (snapshot.revision !== payload.revision) throw Object.assign(new Error("conflict"), { statusCode: 409 });
      snapshot = { ...snapshot, ...payload, revision: snapshot.revision + 1 };
      return { ...snapshot };
    },
  };
  return {
    repository,
    scopes,
    get: () => snapshot,
    set: (value: Partial<IssueSnapshot>) => {
      snapshot = { ...snapshot, ...value };
    },
  };
}
describe("page description shared CAS adapter", () => {
  it("shares page identity across project scopes and atomically projects title/body", async () => {
    const api = fixture();
    const store = new IssueDescriptionStore(api.repository, pageCodec, validatePageSnapshot);
    const first = new Y.Doc(),
      second = new Y.Doc();
    try {
      await store.load(room, first, { cookie: "a", userId: "a", projectId });
      await store.load(room, second, { cookie: "b", userId: "b", projectId: otherProject });
      Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
      expect(first.getText("title").toString()).toBe("Page title");
      expect(first.get("content", Y.XmlText).length).toBe(1);
      first.getText("title").insert(0, "New ");
      store.changed(first, { cookie: "b", userId: "b", projectId: otherProject });
      await store.synchronize(room, first);
      expect(api.get().name).toBe("New Page title");
      expect(api.get().description_html).toContain("body");
      expect(api.scopes).toContain(projectId);
      expect(api.scopes.at(-1)).toBe(otherProject);
      const restored = new Y.Doc();
      try {
        await store.load(room, restored, { cookie: "a", userId: "a", projectId });
        expect(restored.getText("title").toString()).toBe("New Page title");
      } finally {
        restored.destroy();
      }
    } finally {
      first.destroy();
      second.destroy();
    }
  });
  it("fences epoch changes and rejects locked-page title edits", async () => {
    const api = fixture(),
      document = new Y.Doc();
    const store = new IssueDescriptionStore(api.repository, pageCodec, validatePageSnapshot);
    try {
      await store.load(room, document, { cookie: "a", userId: "a", projectId });
      document.getText("title").insert(0, "unsaved");
      store.changed(document, { cookie: "a", userId: "a", projectId });
      api.set({ can_edit: false });
      await expect(store.synchronize(room, document)).rejects.toThrow("forbidden");
      api.set({ epoch: 1 });
      await expect(store.synchronize(room, document)).rejects.toThrow("externally");
      expect(api.get().name).toBe("Page title");
    } finally {
      document.destroy();
    }
  });
  it("checks each connection project scope and sets server readonly", async () => {
    const api = fixture();
    api.set({ can_edit: false });
    const server = createPageDescriptionServer({
      repository: api.repository,
      currentUser: async () => ({ id: "a", display_name: "A" }),
    });
    const connection = { readOnly: false };
    const input = {
      documentName: room,
      token: JSON.stringify({ id: "a", projectId }),
      requestHeaders: { cookie: "a", origin: "https://plane.test" },
      connection,
    };
    await server.configuration.onAuthenticate!(input as never);
    expect(connection.readOnly).toBe(true);
    expect(api.scopes).toEqual([projectId]);
    await expect(
      server.configuration.onAuthenticate!({ ...input, token: JSON.stringify({ id: "a", projectId: "bad" }) } as never)
    ).rejects.toThrow("project");
    await server.destroy();
  });
  it("rejects project-scoped or malformed document names", () => {
    expect(parsePageRoom(room).pageId).toBe(pageId);
    expect(() => parsePageRoom(`plate-page:v1:workspace:${projectId}:${pageId}:0`)).toThrow();
  });
});
