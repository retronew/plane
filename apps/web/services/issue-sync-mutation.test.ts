import { afterEach, expect, it, vi } from "vitest";
import { onIssueSyncMutation, withIssueSyncMutation } from "./issue-sync-mutation";
const mocks = vi.hoisted(() => ({ pause: vi.fn(), resume: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/sync/issue-sync", () => ({ issueSync: { pause: mocks.pause, invalidate: mocks.invalidate } }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it.each([false, true])(
  "pauses writes, aborts active lists, and releases after reconciliation (failure %s)",
  async (fails) => {
    vi.useFakeTimers();
    mocks.pause.mockReturnValue(mocks.resume);
    const abort = vi.fn();
    const unsubscribe = onIssueSyncMutation(abort);
    const request = withIssueSyncMutation(async () => {
      if (fails) throw new Error("failed");
      return "ok";
    });
    if (fails) await expect(request).rejects.toThrow("failed");
    else await expect(request).resolves.toBe("ok");
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
    expect(mocks.resume).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(mocks.resume).toHaveBeenCalledOnce();
    unsubscribe();
  }
);
