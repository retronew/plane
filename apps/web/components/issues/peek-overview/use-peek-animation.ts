import { useLayoutEffect, useRef } from "react";
import type { TPeekModes } from "./header";

/** Keep layout changes out of the panel's entrance/exit animation. */
export function usePeekAnimation(
  panelRef: React.RefObject<HTMLDivElement | null>,
  mode: TPeekModes,
  embedded: boolean,
  closing: boolean
) {
  const previousMode = useRef<TPeekModes | undefined>(undefined);
  // StrictMode replays mount effects after cancelling the first animation.
  // Reset only on mount cleanup so the replay still runs the full entrance.
  useLayoutEffect(
    () => () => {
      previousMode.current = undefined;
    },
    []
  );
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (embedded || closing || !panel) return;
    const switching = previousMode.current !== undefined;
    previousMode.current = mode;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames: Keyframe[] = switching
      ? [{ opacity: 0.72 }, { opacity: 1 }]
      : reducedMotion
        ? [{ opacity: 0 }, { opacity: 1 }]
        : mode === "side-peek"
          ? [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]
          : [
              { opacity: 0, transform: "translateY(8px) scale(0.99)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ];
    const animation = panel.animate(frames, {
      duration: switching ? 140 : 200,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    return () => animation.cancel();
  }, [panelRef, mode, embedded, closing]);
}
