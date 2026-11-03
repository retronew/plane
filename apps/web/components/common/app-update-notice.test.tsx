import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppUpdateNotice } from "./app-update-notice";

const mocks = vi.hoisted(() => ({ add: vi.fn(() => "notice"), close: vi.fn(), t: (key: string) => key }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@plane/blocks/toast", () => ({ toastManager: mocks }));
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
  expect(mocks.add).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ buildId: "next" }) } as Response);
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(mocks.add).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 0,
      title: "app_update.title",
      data: expect.objectContaining({ primaryAction: expect.objectContaining({ label: "app_update.refresh" }) }),
    })
  );
  await act(() => vi.advanceTimersByTimeAsync(120_000));
  expect(mocks.add).toHaveBeenCalledTimes(1);
});
it("ignores failed or invalid responses and retries on return to the tab", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  render(<AppUpdateNotice />);
  await act(async () => {});
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: 5 }) } as Response);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(mocks.add).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: "next" }) } as Response);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(mocks.add).toHaveBeenCalledTimes(1);
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
