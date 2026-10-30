import { expect, it, vi } from "vitest";
import { observeDropGaps } from "./drop-gaps";

it("covers both halves of collapsed gaps and disconnects observers", () => {
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  try {
    const parent = document.createElement("div");
    const nodes = Array.from({ length: 3 }, () => document.createElement("div"));
    parent.append(...nodes);
    const bounds = [
      [0, 20],
      [40, 60],
      [90, 110],
    ];
    nodes.forEach((node, index) => {
      vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
        top: bounds[index][0],
        bottom: bounds[index][1],
      } as DOMRect);
    });
    const cleanup = observeDropGaps(nodes[1]);
    expect(nodes[1].style.getPropertyValue("--drop-gap-before")).toBe("10px");
    expect(nodes[1].style.getPropertyValue("--drop-gap-after")).toBe("15px");
    const calls = disconnect.mock.calls.length;
    cleanup?.();
    expect(disconnect).toHaveBeenCalledTimes(calls + 1);
  } finally {
    vi.unstubAllGlobals();
  }
});
