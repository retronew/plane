import { StrictMode, useRef } from "react";
import { render, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import type { TPeekModes } from "./header";
import { usePeekAnimation } from "./use-peek-animation";

afterEach(() => vi.restoreAllMocks());

function fixture(reduced = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced }))
  );
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  const panel = { current: { animate } as unknown as HTMLDivElement };
  const view = renderHook(({ mode, closing, embedded }) => usePeekAnimation(panel, mode, embedded, closing), {
    initialProps: { mode: "side-peek" as TPeekModes, closing: false, embedded: false },
  });
  return { view, animate, cancel };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDivElement.prototype, "animate");
});

it("slides in only on mount and changes layout without moving or scaling content", () => {
  const { view, animate, cancel } = fixture();
  expect(animate.mock.calls[0]).toEqual([
    [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
    expect.objectContaining({ duration: 200 }),
  ]);
  view.rerender({ mode: "modal", closing: false, embedded: false });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(animate).toHaveBeenLastCalledWith(
    [{ opacity: 0.72 }, { opacity: 1 }],
    expect.objectContaining({ duration: 140 })
  );
  view.rerender({ mode: "side-peek", closing: false, embedded: false });
  expect(animate).toHaveBeenLastCalledWith(
    [{ opacity: 0.72 }, { opacity: 1 }],
    expect.objectContaining({ duration: 140 })
  );
  view.rerender({ mode: "side-peek", closing: true, embedded: false });
  expect(animate).toHaveBeenCalledTimes(3);
  expect(cancel).toHaveBeenCalledTimes(3);
});

it("fades in without displacement under reduced motion", () => {
  const { view, animate, cancel } = fixture(true);
  expect(animate).toHaveBeenLastCalledWith(
    [{ opacity: 0 }, { opacity: 1 }],
    expect.objectContaining({ duration: 200 })
  );
  view.rerender({ mode: "modal", closing: false, embedded: false });
  expect(animate).toHaveBeenLastCalledWith(
    [{ opacity: 0.72 }, { opacity: 1 }],
    expect.objectContaining({ duration: 140 })
  );
  view.rerender({ mode: "modal", closing: true, embedded: false });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(2);
});

it.each([
  { mode: "side-peek" as TPeekModes, reduced: false },
  { mode: "modal" as TPeekModes, reduced: false },
  { mode: "side-peek" as TPeekModes, reduced: true },
  { mode: "modal" as TPeekModes, reduced: true },
])(
  "keeps the $mode entrance through StrictMode replay (reduced motion: $reduced)",
  ({ mode: initialMode, reduced }) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }))
    );
    const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = [];
    const animate = vi.fn(() => {
      const animation = { cancel: vi.fn() };
      animations.push(animation);
      return animation;
    });
    Object.defineProperty(HTMLDivElement.prototype, "animate", { configurable: true, value: animate });
    function Panel({ mode, closing = false }: { mode: TPeekModes; closing?: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      usePeekAnimation(ref, mode, false, closing);
      return <div ref={ref} />;
    }
    const view = render(<Panel mode={initialMode} />, { wrapper: StrictMode });
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations[1].cancel).not.toHaveBeenCalled();
    expect(animate.mock.calls[1]).toEqual(animate.mock.calls[0]);
    const entrance = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : initialMode === "side-peek"
        ? [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]
        : [
            { opacity: 0, transform: "translateY(8px) scale(0.99)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ];
    expect(animate).toHaveBeenLastCalledWith(entrance, expect.objectContaining({ duration: 200 }));
    const nextMode = initialMode === "side-peek" ? "modal" : "side-peek";
    view.rerender(<Panel mode={nextMode} />);
    expect(animate).toHaveBeenLastCalledWith(
      [{ opacity: 0.72 }, { opacity: 1 }],
      expect.objectContaining({ duration: 140 })
    );
    view.rerender(<Panel mode={nextMode} closing />);
    expect(animate).toHaveBeenCalledTimes(3);
    expect(animations[2].cancel).toHaveBeenCalledOnce();
    view.unmount();
  }
);

it("preserves a visible opacity exit for both modes under reduced motion", () => {
  const css = readFileSync(`${import.meta.dirname}/peek-panel.css`, "utf8");
  const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  expect(reducedMotion).toContain("[data-peek-panel][data-closing]");
  expect(reducedMotion).toContain("animation-name: peek-dialog-exit");
  expect(reducedMotion).not.toContain("1ms");
});

it("does not animate embedded details", () => {
  const { view, animate } = fixture();
  animate.mockClear();
  view.rerender({ mode: "modal", closing: false, embedded: true });
  expect(animate).not.toHaveBeenCalled();
});
