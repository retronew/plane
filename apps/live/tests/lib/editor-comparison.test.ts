import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  authenticateComparison,
  ComparisonStore,
  createComparisonServer,
  parseComparisonRoom,
} from "@/editor-comparison";

const mocks = vi.hoisted(() => ({ user: vi.fn(), get: vi.fn() }));
vi.mock("@/env", () => ({ env: { CORS_ALLOWED_ORIGINS: "" } }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    currentUser = mocks.user;
  },
}));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
  },
}));
const project = "11111111-1111-4111-8111-111111111111";
const room = `plate-comparison:v1:workspace:${project}:22222222-2222-4222-8222-222222222222`;
const input = () => ({
  documentName: room,
  token: JSON.stringify({ id: "user" }),
  requestHeaders: { cookie: "session=test", origin: "http://localhost:3000" },
  requestParameters: new URLSearchParams({ workspaceSlug: "workspace", projectId: project }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user", display_name: "User" });
  mocks.get.mockResolvedValue({
    data: { member: { id: "user" }, project: { id: project }, role: 15, is_active: true },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("comparison authorization", () => {
  it("checks authenticated identity and scoped active membership on every connection", async () => {
    await authenticateComparison(input());
    await authenticateComparison(input());
    expect(mocks.user).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenCalledWith(`/api/workspaces/workspace/projects/${project}/project-members/me/`, {
      headers: { Cookie: "session=test" },
    });
  });
  it.each(["page-id", "../../escape", room.replace("v1", "v2"), `${room}:extra`])(
    "rejects malformed room %s",
    (name) => {
      expect(() => parseComparisonRoom(name)).toThrow();
    }
  );
  it("rejects room scope mismatch before API calls", async () => {
    const params = input();
    params.requestParameters.set("workspaceSlug", "other");
    await expect(authenticateComparison(params)).rejects.toThrow("scope mismatch");
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("rejects anonymous connections and token cookie injection", async () => {
    await expect(
      authenticateComparison({
        ...input(),
        requestHeaders: { origin: "http://localhost:3000" },
        token: JSON.stringify({ id: "user", cookie: "session=forged" }),
      })
    ).rejects.toThrow("session required");
  });
  it("rejects a foreign origin", async () => {
    await expect(
      authenticateComparison({
        ...input(),
        requestHeaders: { ...input().requestHeaders, origin: "https://evil.example" },
      })
    ).rejects.toThrow("origin forbidden");
  });
  it("rejects a forged user ID", async () => {
    await expect(authenticateComparison({ ...input(), token: JSON.stringify({ id: "other" }) })).rejects.toThrow(
      "user mismatch"
    );
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each([{ role: 5 }, { is_active: false }, { project: "other" }, { member: { id: "other" } }])(
    "rejects unauthorized membership %j",
    async (overrides) => {
      mocks.get.mockResolvedValue({
        data: { member: { id: "user" }, project: { id: project }, role: 15, is_active: true, ...overrides },
      });
      await expect(authenticateComparison(input())).rejects.toThrow("membership forbidden");
    }
  );
  it("propagates revoked session or membership denial", async () => {
    mocks.get.mockRejectedValue(new Error("forbidden"));
    await expect(authenticateComparison(input())).rejects.toThrow("forbidden");
  });
  it.each(["production", "test", ""])("does not create an endpoint outside development (%s)", (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    expect(createComparisonServer()).toBeUndefined();
  });
});

describe("comparison raw Yjs persistence", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "plane-comparison-"));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("initializes concurrent first loads once with one empty Slate paragraph", async () => {
    const store = new ComparisonStore(directory);
    const [first, second] = await Promise.all([store.load(room), store.load(room)]);
    expect(first).toEqual(new Uint8Array(second));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, first);
    Y.applyUpdate(doc, second);
    const delta = doc.get("content", Y.XmlText).toDelta();
    expect(delta).toHaveLength(1);
    expect(delta[0].attributes).toEqual({ type: "p" });
    expect(delta[0].insert).toBeInstanceOf(Y.XmlText);
    expect(doc.getMap("comparison").get("schema")).toBe(1);
    doc.destroy();
  });
  it("reloads exact edits in a fresh store and isolates rooms", async () => {
    const store = new ComparisonStore(directory);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, await store.load(room));
    const paragraph = doc.get("content", Y.XmlText).toDelta()[0].insert as Y.XmlText;
    paragraph.insert(0, "实时编辑");
    await store.save(room, Y.encodeStateAsUpdate(doc));
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, await new ComparisonStore(directory).load(room));
    expect((reloaded.get("content", Y.XmlText).toDelta()[0].insert as Y.XmlText).toString()).toBe("实时编辑");
    const other = new Y.Doc();
    Y.applyUpdate(other, await store.load(room.replace("22222222-2222", "33333333-3333")));
    expect((other.get("content", Y.XmlText).toDelta()[0].insert as Y.XmlText).toString()).toBe("");
    doc.destroy();
    reloaded.destroy();
    other.destroy();
  });
  it("preserves deliberate empty content after restart without reseeding", async () => {
    const store = new ComparisonStore(directory);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, await store.load(room));
    doc.get("content", Y.XmlText).delete(0, 1);
    await store.save(room, Y.encodeStateAsUpdate(doc));
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, await new ComparisonStore(directory).load(room));
    expect(reloaded.get("content", Y.XmlText).length).toBe(0);
    doc.destroy();
    reloaded.destroy();
  });
  it("rejects invalid room paths for both read and write", async () => {
    const store = new ComparisonStore(directory);
    await expect(store.load("../outside")).rejects.toThrow();
    await expect(store.save("../outside", new Uint8Array())).rejects.toThrow();
  });
});
