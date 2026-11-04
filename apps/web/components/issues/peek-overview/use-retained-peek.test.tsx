import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PEEK_EXIT_DURATION, useRetainedPeek } from "./use-retained-peek";

afterEach(() => vi.useRealTimers());
it("retains closing content until the animation finishes", () => {
  vi.useFakeTimers();
  const item = { id: "one" };
  const view = renderHook(({ value }) => useRetainedPeek(value), {
    initialProps: { value: item as typeof item | undefined },
  });
  view.rerender({ value: undefined });
  expect(view.result.current).toMatchObject({ item, closing: true });
  act(() => vi.advanceTimersByTime(PEEK_EXIT_DURATION - 1));
  expect(view.result.current.item).toBe(item);
  act(() => vi.advanceTimersByTime(1));
  expect(view.result.current).toMatchObject({ item: undefined, closing: false });
});
it("unmounts on animation completion and ignores stale completion after reopening", () => {
  vi.useFakeTimers();
  const view = renderHook(({ value }) => useRetainedPeek(value), {
    initialProps: { value: "one" as string | undefined },
  });
  view.rerender({ value: undefined });
  act(() => view.result.current.onExited());
  expect(view.result.current.item).toBeUndefined();
  view.rerender({ value: "two" });
  act(() => view.result.current.onExited());
  expect(view.result.current.item).toBe("two");
});

it("cancels a pending exit when another item opens", () => {
  vi.useFakeTimers();
  const view = renderHook(({ value }) => useRetainedPeek(value), {
    initialProps: { value: "one" as string | undefined },
  });
  view.rerender({ value: undefined });
  view.rerender({ value: "two" });
  act(() => vi.advanceTimersByTime(PEEK_EXIT_DURATION));
  expect(view.result.current).toMatchObject({ item: "two", closing: false });
});
it("does not retain embedded notifications or mount an empty panel", () => {
  const view = renderHook(({ value }) => useRetainedPeek(value, false), {
    initialProps: { value: "one" as string | undefined },
  });
  view.rerender({ value: undefined });
  expect(view.result.current).toMatchObject({ item: undefined, closing: false });
});
