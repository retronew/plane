import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useAutoScroller } from "./use-auto-scroller";

it("clears active scrolling when disabled and on unmount", () => {
  vi.useFakeTimers();
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  element.scrollBy = vi.fn();
  const containerRef = { current: element };
  try {
    const { rerender, unmount } = renderHook(({ enabled }) => useAutoScroller(containerRef, enabled), {
      initialProps: { enabled: true },
    });
    act(() => element.dispatchEvent(new MouseEvent("mousemove", { clientX: 99, clientY: 50 })));
    expect(vi.getTimerCount()).toBe(1);
    rerender({ enabled: false });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ enabled: true });
    act(() => element.dispatchEvent(new MouseEvent("mousemove", { clientX: 99, clientY: 50 })));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
