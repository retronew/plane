import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { usePeekMode } from "./use-peek-mode";

beforeEach(() => localStorage.removeItem("issue_peek_mode"));
it("remembers a selected mode across instances and remounts", () => {
  const first = renderHook(() => usePeekMode());
  const second = renderHook(() => usePeekMode());
  expect(first.result.current.mode).toBe("side-peek");
  act(() => first.result.current.setMode("modal"));
  expect(second.result.current.mode).toBe("modal");
  first.unmount();
  const reopened = renderHook(() => usePeekMode());
  expect(reopened.result.current.mode).toBe("modal");
  act(() => reopened.result.current.setMode("side-peek"));
  expect(second.result.current.mode).toBe("side-peek");
  expect(JSON.parse(localStorage.getItem("issue_peek_mode")!)).toBe("side-peek");
});
it.each(["old-mode", "full-screen"])("falls back to side peek for the unsupported saved mode %s", (mode) => {
  localStorage.setItem("issue_peek_mode", JSON.stringify(mode));
  const view = renderHook(() => usePeekMode());
  expect(view.result.current.mode).toBe("side-peek");
});
