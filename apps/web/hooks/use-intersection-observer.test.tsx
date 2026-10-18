import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useIntersectionObserver } from "./use-intersection-observer";

it("disconnects the observer when its target changes and on unmount", () => {
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect = disconnect;
    }
  );
  try {
    const containerRef = { current: document.createElement("div") };
    const callback = vi.fn();
    const first = document.createElement("div");
    const second = document.createElement("div");
    const { rerender, unmount } = renderHook(({ target }) => useIntersectionObserver(containerRef, target, callback), {
      initialProps: { target: first },
    });
    expect(observe).toHaveBeenCalledWith(first);
    rerender({ target: second });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(second);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
