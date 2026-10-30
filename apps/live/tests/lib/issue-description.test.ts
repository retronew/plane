/* eslint-disable no-await-in-loop -- Poll real websocket state until its asynchronous transition completes. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { OutgoingMessage } from "@hocuspocus/server";
import * as Y from "yjs";
import {
  createIssueDescriptionServer,
  IssueDescriptionStore,
  IssueEpochConflict,
  issueCodec,
  parseIssueRoom,
} from "@/issue-description";
import type { IssueCodec, IssueRepository, IssueSnapshot, IssueWrite } from "@/issue-description";

vi.mock("@/env", () => ({ env: { CORS_ALLOWED_ORIGINS: "https://plane.test" } }));
const issueId = "22222222-2222-4222-8222-222222222222";
const room = `plate-issue:v1:workspace:11111111-1111-4111-8111-111111111111:${issueId}:0`;
const actor = { userId: "alice", cookie: "alice" };
const codec: IssueCodec = {
  seed(html) {
    const doc = new Y.Doc();
    doc.getText("test").insert(0, html);
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();
    return state;
  },
  html(doc) {
    return doc.getText("test").toString();
  },
};
class Repository implements IssueRepository {
  snapshot: IssueSnapshot = {
    format: "slate-yjs-v1",
    schema_version: 1,
    epoch: 0,
    revision: 0,
    state: null,
    description_html: "original",
    source_hash: "hash",
    can_read: true,
    can_edit: true,
    issue_id: issueId,
  };
  readonly = new Set<string>();
  revoked = new Set<string>();
  writes: { cookie: string; payload: IssueWrite }[] = [];
  fail = false;
  async read(_room: string, cookie: string) {
    if (this.revoked.has(cookie)) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    return { ...this.snapshot, can_edit: !this.readonly.has(cookie) };
  }
  async write(_room: string, cookie: string, payload: IssueWrite, initialize: boolean) {
    if (this.fail) throw new Error("offline");
    if (
      this.revoked.has(cookie) ||
      (!initialize && (this.readonly.has(cookie) || payload.contributors?.some((id) => this.revoked.has(id))))
    )
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    if (payload.epoch !== this.snapshot.epoch || payload.revision !== this.snapshot.revision)
      throw Object.assign(new Error("conflict"), { statusCode: 409 });
    this.writes.push({ cookie, payload });
    this.snapshot = {
      ...this.snapshot,
      state: payload.state,
      revision: this.snapshot.revision + 1,
      description_html: payload.description_html ?? this.snapshot.description_html,
    };
    return { ...this.snapshot };
  }
}
const docs: Y.Doc[] = [];
const doc = () => {
  const value = new Y.Doc();
  docs.push(value);
  return value;
};
afterEach(() => {
  for (const value of docs.splice(0)) value.destroy();
});

describe("issue description CAS persistence", () => {
  it("converts legacy HTML through the real Slate Yjs codec", () => {
    const document = doc();
    Y.applyUpdate(document, issueCodec.seed("<p>Hello <strong>world</strong></p><h2>Title</h2>"));
    expect(document.get("content", Y.XmlText).length).toBe(2);
    expect(issueCodec.html(document)).toContain("<strong>world</strong>");
    expect(issueCodec.html(document)).toContain("<h2>Title</h2>");
  });
  it("concurrent first loads use exactly one canonical initialization", async () => {
    const repository = new Repository();
    const first = doc(),
      second = doc();
    await Promise.all([
      new IssueDescriptionStore(repository, codec).load(room, first, actor),
      new IssueDescriptionStore(repository, codec).load(room, second, actor),
    ]);
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
    expect(codec.html(first)).toBe("original");
    expect(repository.writes).toHaveLength(1);
  });
  it("merges concurrent instances then regenerates HTML and records real contributors", async () => {
    const repository = new Repository();
    const a = new IssueDescriptionStore(repository, codec),
      b = new IssueDescriptionStore(repository, codec);
    const first = doc(),
      second = doc();
    await a.load(room, first, actor);
    await b.load(room, second, actor);
    first.getText("test").insert(0, "A");
    a.changed(first, actor);
    second.getText("test").insert(0, "B");
    b.changed(second, { userId: "bob", cookie: "bob" });
    await Promise.all([a.synchronize(room, first), b.synchronize(room, second)]);
    await a.synchronize(room, first);
    expect(codec.html(first)).toContain("A");
    expect(codec.html(first)).toContain("B");
    expect(repository.snapshot.description_html).toBe(codec.html(first));
    expect(repository.writes.at(-1)?.cookie).toBe("bob");
    expect(repository.writes.at(-1)?.payload.contributors).toEqual(["bob"]);
  });
  it("restores persisted empty state after restart without reseeding", async () => {
    const repository = new Repository(),
      first = doc();
    const store = new IssueDescriptionStore(repository, codec);
    await store.load(room, first, actor);
    first.getText("test").delete(0, 8);
    store.changed(first, actor);
    await store.synchronize(room, first);
    const restored = doc();
    await new IssueDescriptionStore(repository, codec).load(room, restored, actor);
    expect(codec.html(restored)).toBe("");
  });
  it("rejects external epoch changes without overwriting the replacement", async () => {
    const repository = new Repository(),
      first = doc(),
      store = new IssueDescriptionStore(repository, codec);
    await store.load(room, first, actor);
    first.getText("test").insert(0, "old");
    store.changed(first, actor);
    repository.snapshot = { ...repository.snapshot, epoch: 1, revision: 2, state: null, description_html: "external" };
    await expect(store.synchronize(room, first)).rejects.toBeInstanceOf(IssueEpochConflict);
    expect(repository.snapshot.description_html).toBe("external");
  });
  it("retains a failed save and retries it when storage recovers", async () => {
    const repository = new Repository(),
      first = doc(),
      store = new IssueDescriptionStore(repository, codec);
    await store.load(room, first, actor);
    first.getText("test").insert(0, "edit");
    store.changed(first, actor);
    repository.fail = true;
    await expect(store.synchronize(room, first)).rejects.toThrow("offline");
    repository.fail = false;
    await store.synchronize(room, first);
    expect(repository.snapshot.description_html).toBe("editoriginal");
  });
  it("refuses a batch if any contributor loses permission", async () => {
    const repository = new Repository(),
      first = doc(),
      store = new IssueDescriptionStore(repository, codec);
    await store.load(room, first, actor);
    store.changed(first, actor);
    store.changed(first, { userId: "bob", cookie: "bob" });
    repository.revoked.add("alice");
    await expect(store.synchronize(room, first)).rejects.toThrow("forbidden");
    expect(repository.writes).toHaveLength(1);
  });
  it.each(["../../x", room.replace(":0", ":-1"), `${room}:extra`])("rejects invalid room %s", (name) =>
    expect(() => parseIssueRoom(name)).toThrow()
  );
});

// Encode only the public Hocuspocus auth envelope; sync frames use its own encoder.
function uint(value: number): number[] {
  const result = [];
  do {
    let byte = value & 127;
    value >>>= 7;
    if (value) byte |= 128;
    result.push(byte);
  } while (value);
  return result;
}
function string(value: string) {
  const bytes = Buffer.from(value);
  return [...uint(bytes.length), ...bytes];
}
const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe("real websocket issue authorization", () => {
  it("serves same room, blocks readonly forged updates, propagates instances and fences revocation", async () => {
    const repository = new Repository();
    repository.readonly.add("reader");
    const options = {
      repository,
      codec,
      pollInterval: 25,
      origins: ["https://plane.test"],
      currentUser: async (cookie: string) => ({ id: cookie, display_name: cookie }),
    };
    const first = createIssueDescriptionServer(options),
      second = createIssueDescriptionServer(options);
    await first.listen(0);
    await second.listen(0);
    const sockets: WebSocket[] = [];
    const connect = async (server: typeof first, user: string) => {
      const socket = new WebSocket(server.webSocketURL, { headers: { Cookie: user, Origin: "https://plane.test" } });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      });
      socket.send(Buffer.from([...string(room), 2, 0, ...string(JSON.stringify({ id: user }))]));
      await waitFor(
        () =>
          !!server.documents
            .get(room)
            ?.getConnections()
            .some((connection) => connection.context.userId === user)
      );
      return socket;
    };
    try {
      const alice = await connect(first, "alice");
      const reader = await connect(first, "reader");
      await connect(second, "bob");
      expect(first.documents.get(room)?.getConnectionsCount()).toBe(2);
      const forged = doc();
      Y.applyUpdate(forged, Y.encodeStateAsUpdate(first.documents.get(room)!));
      forged.getText("test").insert(0, "FORGED");
      reader.send(
        new OutgoingMessage(room).createSyncMessage().writeUpdate(Y.encodeStateAsUpdate(forged)).toUint8Array()
      );
      const edit = doc();
      Y.applyUpdate(edit, Y.encodeStateAsUpdate(first.documents.get(room)!));
      edit.getText("test").insert(0, "Alice");
      alice.send(new OutgoingMessage(room).createSyncMessage().writeUpdate(Y.encodeStateAsUpdate(edit)).toUint8Array());
      await waitFor(() => codec.html(second.documents.get(room)!).includes("Alice"));
      expect(codec.html(first.documents.get(room)!)).not.toContain("FORGED");
      expect(repository.snapshot.description_html).toBe("Aliceoriginal");
      repository.revoked.add("alice");
      await waitFor(() => alice.readyState === WebSocket.CLOSED);
      repository.snapshot = {
        ...repository.snapshot,
        epoch: 1,
        revision: repository.snapshot.revision + 1,
        state: null,
        description_html: "external replacement",
      };
      await waitFor(() => sockets.every((socket) => socket.readyState === WebSocket.CLOSED));
      expect(repository.snapshot.description_html).toBe("external replacement");
    } finally {
      for (const socket of sockets) socket.terminate();
      await first.destroy();
      await second.destroy();
    }
  });
});
