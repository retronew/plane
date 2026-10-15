import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useChartMotion } from "./motion";
afterEach(() => vi.unstubAllGlobals());
it("uses one short timing and responds to the user's reduced-motion preference", () => {
  let notify = () => {};
  const media = {
    matches: false,
    addEventListener: vi.fn((_event, callback) => {
      notify = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  const { result, unmount } = renderHook(useChartMotion);
  expect(result.current).toMatchObject({ isAnimationActive: true, animationDuration: 300, animationBegin: 0 });
  act(() => {
    media.matches = true;
    notify();
  });
  expect(result.current.isAnimationActive).toBe(false);
  unmount();
  expect(media.removeEventListener).toHaveBeenCalled();
});
