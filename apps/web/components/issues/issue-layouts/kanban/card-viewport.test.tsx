import { afterEach, expect, it, vi } from "vitest";
import { createCardObserver } from "./card-viewport";

afterEach(() => vi.unstubAllGlobals());

it("spreads entering rows over frames and drops rows that left before mounting", () => {
  let deliver!: (entries: Partial<IntersectionObserverEntry>[]) => void;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof deliver) {
        deliver = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  const frames = new Map<number, () => void>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  const rows = Array.from({ length: 3 }, () => document.createElement("div"));
  const notify = vi.fn();
  const observe = createCardObserver();
  const release = rows.map((row) => observe(row, notify));
  deliver(rows.map((target) => ({ target, isIntersecting: true, intersectionRatio: 1 })));
  expect(frames.size).toBe(1);
  const firstFrame = frames.get(1)!;
  frames.delete(1);
  firstFrame();
  expect(notify.mock.calls.map(([entry]) => entry.target)).toEqual([rows[0]]);
  deliver([{ target: rows[1], isIntersecting: false, intersectionRatio: 0 }]);
  release[2]!();
  expect(frames.size).toBe(0);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(notify.mock.calls[1]?.[0].isIntersecting).toBe(false);
  release[0]!();
  release[1]!();
});
