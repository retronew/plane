// Mock MessagePorts do not accept a Window targetOrigin.
/* oxlint-disable unicorn/require-post-message-target-origin */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./notification.worker?worker&url", () => ({ default: "/assets/notification-worker.js" }));
class Port extends EventTarget {
  peer?: Port;
  close = vi.fn();
  start = vi.fn();
  postMessage(data: unknown) {
    this.peer?.dispatchEvent(new MessageEvent("message", { data }));
  }
}
const register = vi.fn();
const postMessage = vi.fn();
const request = { userId: "user", workspace: "workspace", title: "Plane", body: "New event" };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("window", { isSecureContext: true, Notification: {}, indexedDB: {} });
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("navigator", { locks: {}, serviceWorker: { register } });
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1 = new Port();
      port2 = new Port();
      constructor() {
        this.port1.peer = this.port2;
        this.port2.peer = this.port1;
      }
    }
  );
  register.mockResolvedValue({ active: { postMessage } });
  postMessage.mockImplementation((_data: unknown, ports: Port[]) => ports[0].postMessage({ ok: true }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("registers one shared module worker and passes replies through a started message port", async () => {
  const { requestNotificationSync } = await import("./client");
  await requestNotificationSync(request);
  await requestNotificationSync(request);
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith("/assets/notification-worker.js", { type: "module", updateViaCache: "none" });
  expect(postMessage).toHaveBeenCalledWith({ ...request, type: "plane-notifications" }, [expect.any(Port)]);
  const port = postMessage.mock.calls[0][1][0] as Port;
  expect(port.close).toHaveBeenCalled();
  expect(port.peer?.start).toHaveBeenCalled();
});
it("does not register a worker when permission or required capabilities are absent", async () => {
  const { requestNotificationSync, supportsBrowserNotifications } = await import("./client");
  vi.stubGlobal("Notification", { permission: "denied" });
  await expect(requestNotificationSync(request)).rejects.toThrow("unavailable");
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  expect(supportsBrowserNotifications()).toBe(false);
  expect(register).not.toHaveBeenCalled();
});
it("retries registration after a failed registration rather than caching its rejection", async () => {
  register.mockRejectedValueOnce(new Error("registration failed"));
  const { requestNotificationSync } = await import("./client");
  await expect(requestNotificationSync(request)).rejects.toThrow("registration failed");
  await expect(requestNotificationSync(request)).resolves.toBeUndefined();
  expect(register).toHaveBeenCalledTimes(2);
});
it("reports worker delivery errors to the settings UI", async () => {
  postMessage.mockImplementation((_data: unknown, ports: Port[]) => ports[0].postMessage({ ok: false }));
  const { requestNotificationSync } = await import("./client");
  await expect(requestNotificationSync(request)).rejects.toThrow("delivery failed");
});
it("waits for the first worker to activate before posting", async () => {
  const candidate = Object.assign(new EventTarget(), { state: "installing" });
  const registration: { active?: { postMessage: typeof postMessage }; installing: typeof candidate } = {
    installing: candidate,
  };
  register.mockResolvedValueOnce(registration);
  const { requestNotificationSync } = await import("./client");
  const task = requestNotificationSync(request);
  await Promise.resolve();
  await Promise.resolve();
  expect(postMessage).not.toHaveBeenCalled();
  candidate.state = "activated";
  registration.active = { postMessage };
  candidate.dispatchEvent(new Event("statechange"));
  await task;
  expect(postMessage).toHaveBeenCalledTimes(1);
});

it("accepts live same-origin navigation only from the active notification worker for the current user", async () => {
  const { listenForNotificationNavigation } = await import("./client");
  const active = {};
  const getRegistration = vi.fn(async () => ({ active }));
  const serviceWorker = Object.assign(new EventTarget(), { getRegistration });
  vi.stubGlobal("navigator", { serviceWorker });
  vi.stubGlobal("window", { location: { origin: "https://plane.test", href: "https://plane.test/workspace/" } });
  const navigate = vi.fn();
  let userId = "user";
  const stop = listenForNotificationNavigation(() => userId, navigate);
  const dispatch = async (data: Record<string, unknown>, source: unknown = active, origin = "https://plane.test") => {
    const port = { close: vi.fn(), postMessage: vi.fn() };
    const event = Object.assign(new Event("message"), {
      data: {
        type: "plane-browser-notification-open",
        url: "/workspace/notifications/",
        userId: "user",
        expiresAt: Date.now() + 500,
        ...data,
      },
      source,
      origin,
      ports: [port],
    });
    serviceWorker.dispatchEvent(event);
    await Promise.resolve();
    return port.postMessage.mock.calls;
  };
  expect(await dispatch({})).toEqual([[{ ok: true }]]);
  expect(getRegistration).toHaveBeenCalledWith("https://plane.test/assets/notification-worker.js");
  expect(navigate).toHaveBeenCalledWith("https://plane.test/workspace/notifications/");
  expect(await dispatch({ url: "//external.test/" })).toEqual([[{ ok: false }]]);
  expect(await dispatch({ url: "blob:https://plane.test/file" })).toEqual([[{ ok: false }]]);
  expect(await dispatch({ expiresAt: Date.now() - 1 })).toEqual([[{ ok: false }]]);
  expect(await dispatch({}, {})).toEqual([[{ ok: false }]]);
  expect(await dispatch({}, active, "https://external.test")).toEqual([[{ ok: false }]]);
  const pending = dispatch({});
  userId = "different-user";
  expect(await pending).toEqual([[{ ok: false }]]);
  stop();
  expect(await dispatch({})).toEqual([]);
  expect(navigate).toHaveBeenCalledTimes(1);
});
