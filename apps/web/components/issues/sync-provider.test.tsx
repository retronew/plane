import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueSyncProvider } from "./sync-provider";

const mocks = vi.hoisted(() => ({
  setReplay: vi.fn(),
  get: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  suspend: vi.fn(),
  resume: vi.fn(),
  invalidate: vi.fn(),
  pause: vi.fn(),
  release: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  clear: vi.fn(),
  store: { router: { workspaceSlug: "test" }, user: { data: { id: "user" } }, issue: {} },
}));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
  },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/constants", () => ({ API_BASE_URL: "", LIVE_URL: "http://localhost:3002" }));
vi.mock("@/lib/store-context", async () => {
  const { createContext } = await import("react");
  return { StoreContext: createContext(mocks.store) };
});
vi.mock("@/lib/sync/issue-sync", () => ({ issueSync: mocks }));
vi.mock("@/lib/sync/clear-issues", () => ({ clearRevokedIssues: mocks.clear }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.get.mockRejectedValue(new Error("offline"));
  mocks.pause.mockReturnValue(mocks.release);
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function hidden(value: boolean) {
  vi.spyOn(document, "hidden", "get").mockReturnValue(value);
  fireEvent(document, new Event("visibilitychange"));
}
function online(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  fireEvent(window, new Event(value ? "online" : "offline"));
}

it("suspends before connecting on a hidden mount and only resumes when visible and online", () => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const view = render(<IssueSyncProvider />);
  expect(mocks.suspend.mock.invocationCallOrder[0]).toBeLessThan(mocks.connect.mock.invocationCallOrder[0]);
  expect(mocks.resume).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  online(true);
  expect(mocks.resume).not.toHaveBeenCalled();
  online(false);
  hidden(false);
  expect(mocks.resume).not.toHaveBeenCalled();
  online(true);
  expect(mocks.resume).toHaveBeenCalledTimes(1);
  expect(mocks.invalidate).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(30000));
  expect(mocks.invalidate).not.toHaveBeenCalled();
  hidden(true);
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(60000));
  expect(mocks.invalidate).not.toHaveBeenCalled();
  hidden(false);
  act(() => vi.advanceTimersByTime(30000));
  expect(mocks.invalidate).not.toHaveBeenCalled();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("handles page lifecycle, access cleanup and removes event listeners on unmount", () => {
  const view = render(<IssueSyncProvider />);
  fireEvent(window, new Event("pagehide"));
  expect(vi.getTimerCount()).toBe(0);
  const resumes = mocks.resume.mock.calls.length;
  online(true);
  expect(mocks.resume).toHaveBeenCalledTimes(resumes);
  fireEvent(window, new Event("pageshow"));
  expect(mocks.resume).toHaveBeenCalledTimes(resumes + 1);
  const subscription = mocks.subscribe.mock.calls[0][0];
  subscription.onAccessRevoked("project");
  expect(mocks.clear).toHaveBeenCalledWith(mocks.store.issue, "project");
  view.unmount();
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  const suspends = mocks.suspend.mock.calls.length;
  hidden(true);
  online(false);
  fireEvent(window, new Event("pagehide"));
  expect(mocks.suspend).toHaveBeenCalledTimes(suspends);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps unsaved focused input held, releases removed controls, and cleans up timers", () => {
  const view = render(
    <>
      <IssueSyncProvider />
      <input aria-label="editor" />
    </>
  );
  const input = view.getByRole("textbox") as HTMLInputElement;
  input.focus();
  fireEvent.input(input, { target: { value: "unsaved" } });
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.release).not.toHaveBeenCalled();
  hidden(true);
  expect(vi.getTimerCount()).toBe(0);
  hidden(false);
  expect(input.value).toBe("unsaved");
  expect(mocks.release).not.toHaveBeenCalled();
  view.rerender(<IssueSyncProvider />);
  act(() => vi.advanceTimersByTime(250));
  expect(mocks.release).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("releases editing after focusout lets save handlers acquire their hold", () => {
  const view = render(
    <>
      <IssueSyncProvider />
      <textarea />
    </>
  );
  const input = view.getByRole("textbox");
  input.focus();
  fireEvent.input(input);
  input.blur();
  expect(mocks.release).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(0));
  expect(mocks.release).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
