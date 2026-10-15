import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SKELETON_DELAY_MS, useDelayedLoading } from "./use-delayed-loading";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("skips skeletons for fast responses and hides immediately when data arrives", () => {
  const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
    initialProps: { loading: true },
  });
  act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS - 1));
  expect(result.current).toBe(false);
  rerender({ loading: false });
  act(() => vi.advanceTimersByTime(500));
  expect(result.current).toBe(false);
});
it("shows slow requests after the threshold and resets for the next request", () => {
  const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
    initialProps: { loading: true },
  });
  act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
  expect(result.current).toBe(true);
  rerender({ loading: false });
  expect(result.current).toBe(false);
  rerender({ loading: true });
  expect(result.current).toBe(false);
  act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
  expect(result.current).toBe(true);
});
it("supports a custom threshold and cancels pending work on unmount", () => {
  const { result, unmount } = renderHook(() => useDelayedLoading(true, 250));
  act(() => vi.advanceTimersByTime(200));
  expect(result.current).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
