import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TNotification } from "@plane/types";
const state = vi.hoisted(() => ({ values: new Map<string, unknown>(), enabled: true, revision: "initial" }));
vi.mock("@plane/constants", () => ({ API_BASE_URL: "" }));
vi.mock("./storage", () => ({
  getPreference: async () => ({ enabled: state.enabled, revision: state.revision }),
  readState: async (key: string) => structuredClone(state.values.get(key)),
  writeState: async (key: string, value: unknown) => {
    state.values.set(key, structuredClone(value));
  },
}));
type Event = { waitUntil(promise: Promise<unknown>): void; [key: string]: unknown };
let handlers: Record<string, (event: Event) => void>;
let rows: TNotification[][];
let userId: string;
let activeClients: Set<string>;
let show: ReturnType<typeof vi.fn>;
let getClient: ReturnType<typeof vi.fn<(id: string) => Promise<unknown>>>;
let postMessage: ReturnType<typeof vi.fn>;
let focus: ReturnType<typeof vi.fn>;
let openWindow: ReturnType<typeof vi.fn>;
const item = (id: string, extra: Partial<TNotification> = {}) =>
  ({
    id,
    receiver: "user",
    created_at: "2026-11-17T00:00:00Z",
    entity_name: "issue",
    project: "project",
    data: { issue_id: "issue" },
    ...extra,
  }) as TNotification;
async function wake(clientId = "a", extra: Record<string, unknown> = {}) {
  const reply = vi.fn();
  let work: Promise<unknown> | undefined;
  handlers.message({
    data: {
      type: "plane-notifications",
      userId: "user",
      workspace: "workspace",
      title: "Plane",
      body: "New notification",
      ...extra,
    },
    source: { id: clientId },
    ports: [{ postMessage: reply }],
    waitUntil(promise) {
      work = promise;
    },
  });
  await work;
  return reply;
}
const advance = () => vi.setSystemTime(Date.now() + 31000);

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", "");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
  state.values.clear();
  state.enabled = true;
  state.revision = "initial";
  handlers = {};
  rows = [[], []];
  userId = "user";
  activeClients = new Set(["a", "b"]);
  show = vi.fn().mockResolvedValue(undefined);
  postMessage = vi.fn((_data: unknown, [port]: MessagePort[]) => port.postMessage({ ok: true }));
  focus = vi.fn(async () => ({ id: "a", url: "https://plane.test/workspace/issues/", postMessage }));
  openWindow = vi.fn().mockResolvedValue(undefined);
  getClient = vi.fn(async (id: string) =>
    activeClients.has(id) ? { id, url: "https://plane.test/workspace/issues/", postMessage, focus } : undefined
  );
  let queue = Promise.resolve();
  vi.stubGlobal("location", { origin: "https://plane.test" });
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, callback: () => Promise<void>) => {
        // Serialize callback execution like the browser's origin-wide lock manager.
        // oxlint-disable-next-line promise/no-callback-in-promise
        const work = queue.then(callback);
        queue = work.catch(() => {});
        return work;
      },
    },
  });
  vi.stubGlobal("registration", { showNotification: show });
  vi.stubGlobal("clients", {
    get: getClient,
    matchAll: async () => [await getClient("a")].filter(Boolean),
    openWindow,
  });
  vi.stubGlobal("addEventListener", (type: string, callback: (event: Event) => void) => {
    handlers[type] = callback;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/users/me/") return { ok: true, json: async () => ({ id: userId }) };
      const mentioned = new URL(url, "https://plane.test").searchParams.get("mentioned") === "true";
      return { ok: true, json: async () => ({ results: rows[mentioned ? 1 : 0], next_page_results: false }) };
    })
  );
  await import("./notification.worker");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("single notification worker", () => {
  it("suppresses history then delivers ordinary and mention events only once for two concurrent pages", async () => {
    rows = [[item("old")], []];
    await Promise.all([wake("a"), wake("b")]);
    expect(show).not.toHaveBeenCalled();
    rows = [[item("new", { created_at: "2026-11-17T01:00:00Z" }), item("old")], [item("mention")]];
    advance();
    await Promise.all([wake("a"), wake("b")]);
    expect(show).toHaveBeenCalledTimes(2);
    advance();
    await wake();
    expect(show).toHaveBeenCalledTimes(2);
  });
  it("shows the work item title for ordinary and mention events without showing message contents", async () => {
    const issue = (name: string) => ({
      id: "issue",
      name,
      sequence_id: 1,
      identifier: "PROJECT",
      state_name: undefined,
      state_group: undefined,
    });
    await wake();
    rows = [
      [item("ordinary", { data: { issue: issue("  Fix the test runner  ") }, message_html: "Private description" })],
      [item("mention", { data: { issue: issue("Update QA notes") }, message_html: "Private comment" })],
    ];
    advance();
    await wake();
    expect(show).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenNthCalledWith(1, "Fix the test runner", {
      body: "New notification",
      tag: "plane:user:ordinary",
      icon: "/favicon.ico",
      data: { userId: "user", url: "/workspace/projects/project/issues/issue/" },
    });
    expect(show).toHaveBeenNthCalledWith(2, "Update QA notes", expect.objectContaining({ body: "New notification" }));
  });

  it("keeps generic titles for missing or blank work item titles and for non-work-item events", async () => {
    const issue = {
      id: "issue",
      name: "  ",
      sequence_id: 1,
      identifier: "PROJECT",
      state_name: undefined,
      state_group: undefined,
    };
    await wake();
    rows[0] = [
      item("missing", { title: "Do not use the freeform event title" }),
      item("blank", { data: { issue } }),
      item("summary", { entity_name: "daily_digest", data: { issue: { ...issue, name: "Private summary title" } } }),
    ];
    advance();
    await wake();
    expect(show.mock.calls.map(([title, options]) => [title, options.body])).toEqual([
      ["Plane", "New notification"],
      ["Plane", "New notification"],
      ["Plane", "New notification"],
    ]);
  });

  it("only delivers new notifications after a page reopens when all workspace pages were closed", async () => {
    await wake();
    activeClients.clear();
    rows[0] = [item("while-closed")];
    advance();
    vi.mocked(fetch).mockClear();
    await wake();
    expect(fetch).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(handlers.push).toBeUndefined();

    activeClients.add("a");
    await wake();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith("Plane", expect.objectContaining({ tag: "plane:user:while-closed" }));
  });

  it("survives initiating-page closure and worker restart using persistent checkpoints", async () => {
    await wake();
    activeClients.delete("a");
    rows[0] = [item("new")];
    advance();
    await wake("a");
    expect(show).not.toHaveBeenCalled();
    await wake("b");
    expect(show).toHaveBeenCalledTimes(1);
    vi.resetModules();
    await import("./notification.worker");
    advance();
    await wake("b");
    expect(show).toHaveBeenCalledTimes(1);
  });
  it("discards stale account and workspace requests", async () => {
    await wake();
    rows[0] = [item("new")];
    advance();
    userId = "other";
    await wake();
    expect(show).not.toHaveBeenCalled();
    userId = "user";
    getClient.mockResolvedValue({ id: "a", url: "https://plane.test/other/issues/" });
    await wake();
    expect(show).not.toHaveBeenCalled();
  });
  it("resets the baseline after disabling and re-enabling, without backfilling disabled-time events", async () => {
    await wake();
    state.enabled = false;
    rows[0] = [item("disabled-time")];
    advance();
    await wake();
    expect(show).not.toHaveBeenCalled();
    state.enabled = true;
    state.revision = "new-setting";
    await wake();
    expect(show).not.toHaveBeenCalled();
  });
  it("does not display read events or events for a different receiver", async () => {
    await wake();
    rows[0] = [item("read", { read_at: "today" }), item("wrong", { receiver: "other" })];
    advance();
    await wake();
    expect(show).not.toHaveBeenCalled();
  });
  it("retains claims across OS delivery errors instead of producing duplicate notifications", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await wake();
    rows[0] = [item("new")];
    advance();
    show.mockRejectedValueOnce(new Error("OS error"));
    const reply = await wake();
    expect(reply).toHaveBeenCalledWith({ ok: false });
    advance();
    await wake();
    expect(show).toHaveBeenCalledTimes(1);
  });
  it("reports a network failure and recovers on another page's next wake", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await wake();
    rows[0] = [item("new")];
    advance();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await wake()).toHaveBeenCalledWith({ ok: false });
    await wake("b");
    expect(show).toHaveBeenCalledTimes(1);
  });
  it("only shows a user-triggered test without modifying the normal feed baseline", async () => {
    await wake("a", { test: true });
    expect(show).toHaveBeenCalledTimes(1);
    expect(state.values.size).toBe(0);
  });
  it("focuses and messages existing tabs, opens when a tab declines, and rejects stale accounts and external targets", async () => {
    async function click(url: string) {
      let work: Promise<unknown> | undefined;
      handlers.notificationclick({
        notification: { close: vi.fn(), data: { userId: "user", url } },
        waitUntil(promise) {
          work = promise;
        },
      });
      await work;
    }
    await click("/workspace/notifications/");
    expect(focus).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "plane-browser-notification-open",
        userId: "user",
        url: "https://plane.test/workspace/notifications/",
        expiresAt: expect.any(Number),
      },
      [expect.anything()]
    );
    await click("https://evil.test/");
    userId = "other";
    await click("/workspace/notifications/");
    expect(focus).toHaveBeenCalledTimes(1);
    expect(openWindow).not.toHaveBeenCalled();
    userId = "user";
    postMessage.mockImplementationOnce((_data: unknown, [port]: MessagePort[]) => port.postMessage({ ok: false }));
    await click("/workspace/notifications/");
    expect(openWindow).toHaveBeenCalledWith("https://plane.test/workspace/notifications/");
  });
});
