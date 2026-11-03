import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppUpdateNotice } from "./app-update-notice";

const mocks = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: mocks.t }) }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("__PLANE_WEB_BUILD_ID__", "current");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildId: "current" }) }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("checks without caching and only prompts once when a different build is found", async () => {
  render(<AppUpdateNotice />);
  await act(async () => {});
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/version.json?"),
    expect.objectContaining({ cache: "no-store" })
  );
  expect(screen.queryByText("app_update.title")).toBeNull();
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ buildId: "next" }) } as Response);
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(screen.getByText("app_update.title").closest("[data-app-update-banner]")).toBeTruthy();
  expect(screen.getByRole("button", { name: "app_update.refresh" })).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(120_000));
  expect(screen.getAllByText("app_update.title")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(screen.queryByText("app_update.title")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(screen.queryByText("app_update.title")).toBeNull();
});
it("ignores failed or invalid responses and retries on return to the tab", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  render(<AppUpdateNotice />);
  await act(async () => {});
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: 5 }) } as Response);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(screen.queryByText("app_update.title")).toBeNull();
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: "next" }) } as Response);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(screen.getByText("app_update.title")).toBeTruthy();
});
it("avoids background polling and aborts an in-flight check on unmount", async () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const view = render(<AppUpdateNotice />);
  expect(fetch).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(120_000));
  expect(fetch).toHaveBeenCalledTimes(1);
});
