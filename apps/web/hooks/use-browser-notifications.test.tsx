import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBrowserNotifications } from "./use-browser-notifications";
const mocks = vi.hoisted(() => ({
  user: { id: "user" },
  get: vi.fn(),
  write: vi.fn(),
  sync: vi.fn(),
  supported: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: mocks.user }) }));
vi.mock("@/lib/browser-notifications/storage", () => ({
  getPreference: mocks.get,
  writeState: mocks.write,
  preferenceKey: (id: string) => `enabled:${id}`,
}));
vi.mock("@/lib/browser-notifications/client", () => ({
  supportsBrowserNotifications: mocks.supported,
  requestNotificationSync: mocks.sync,
  NOTIFICATION_PREFERENCE_EVENT: "notification-setting-test",
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "user" };
  mocks.get.mockResolvedValue({ enabled: true, revision: "initial" });
  mocks.write.mockResolvedValue(undefined);
  mocks.sync.mockResolvedValue(undefined);
  mocks.supported.mockReturnValue(true);
  mocks.permission.mockResolvedValue("granted");
  vi.stubGlobal("Notification", { permission: "default", requestPermission: mocks.permission });
  vi.stubGlobal("BroadcastChannel", undefined);
});
afterEach(() => vi.unstubAllGlobals());

it("removes window and cross-tab subscriptions on unmount", async () => {
  const close = vi.fn();
  const removeMessage = vi.fn();
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener = vi.fn();
      removeEventListener = removeMessage;
      close = close;
    }
  );
  const removeWindow = vi.spyOn(window, "removeEventListener");
  const { result, unmount } = renderHook(useBrowserNotifications);
  await waitFor(() => expect(result.current.permission).toBe("default"));
  unmount();
  expect(close).toHaveBeenCalledTimes(1);
  expect(removeMessage).toHaveBeenCalledWith("message", expect.any(Function));
  expect(removeWindow).toHaveBeenCalledWith("focus", expect.any(Function));
  expect(removeWindow).toHaveBeenCalledWith("notification-setting-test", expect.any(Function));
  removeWindow.mockRestore();
});

it("loads the browser preference without requesting permission on mount", async () => {
  const { result } = renderHook(useBrowserNotifications);
  await waitFor(() => expect(result.current.permission).toBe("default"));
  expect(result.current.enabled).toBe(true);
  expect(mocks.permission).not.toHaveBeenCalled();
});
it("requests permission only on invocation and never retries denied permission", async () => {
  const { result } = renderHook(useBrowserNotifications);
  await waitFor(() => expect(result.current.permission).toBe("default"));
  await act(async () => result.current.requestPermission());
  expect(mocks.permission).toHaveBeenCalledTimes(1);
  vi.stubGlobal("Notification", { permission: "denied", requestPermission: mocks.permission });
  await act(async () => result.current.requestPermission());
  expect(mocks.permission).toHaveBeenCalledTimes(1);
});
it("persists per-user changes and reports storage errors without changing the saved toggle", async () => {
  const { result } = renderHook(useBrowserNotifications);
  await waitFor(() => expect(result.current.permission).toBe("default"));
  mocks.write.mockRejectedValueOnce(new Error("quota"));
  act(() => result.current.setEnabled(false));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.enabled).toBe(true);
  act(() => result.current.setEnabled(false));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(mocks.write).toHaveBeenLastCalledWith("enabled:user", { enabled: false, revision: expect.any(String) });
});
it("ignores stale preference responses after changing accounts", async () => {
  let finish: ((value: { enabled: boolean }) => void) | undefined;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result, rerender } = renderHook(useBrowserNotifications);
  mocks.user = { id: "other" };
  rerender();
  await waitFor(() => expect(result.current.permission).toBe("default"));
  await act(async () => finish?.({ enabled: false }));
  expect(result.current.enabled).toBe(true);
});
it("reports test delivery failure and gracefully handles unsupported browsers", async () => {
  const { result, rerender } = renderHook(useBrowserNotifications);
  mocks.sync.mockRejectedValueOnce(new Error("worker failed"));
  await act(async () => result.current.sendTest());
  expect(result.current.error).toBe(true);
  mocks.supported.mockReturnValue(false);
  rerender();
  await waitFor(() => expect(result.current.permission).toBe("unsupported"));
  expect(result.current.supported).toBe(false);
});
