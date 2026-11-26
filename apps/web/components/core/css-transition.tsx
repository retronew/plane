/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@plane/utils";

/**
 * Where the element is in its enter/leave cycle. `entering` wears the "from" end of the animated
 * properties; `left` means the element has unmounted.
 */
type TransitionPhase = "entering" | "entered" | "leaving" | "left";

/**
 * Hand-rolled enter/leave, replacing Headless UI's `Transition` (Ruling 36). The element stays in
 * the DOM for the length of the leave transition so the exit is visible, then unmounts.
 */
function useTransitionPhase(show: boolean, leaveDurationMs: number): TransitionPhase {
  const [state, setState] = useState<{ show: boolean; phase: TransitionPhase }>({
    show,
    phase: show ? "entered" : "left",
  });
  let phase = state.phase;
  if (state.show !== show) {
    phase = show ? "entering" : state.phase === "left" ? "left" : "leaving";
    setState({ show, phase });
  }
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPending = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      frameRef.current = null;
      timerRef.current = null;
    };
    clearPending();
    if (show) {
      // Two frames: the element has to paint in its "from" state before the classes flip, or the
      // browser coalesces both styles into one and no transition runs at all.
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => setState({ show: true, phase: "entered" }));
      });
    } else {
      timerRef.current = setTimeout(() => setState({ show: false, phase: "left" }), leaveDurationMs);
    }
    return clearPending;
  }, [show, leaveDurationMs]);

  return phase;
}

type CssTransitionProps = {
  children: React.ReactNode;
  show: boolean;
  /** Transition property class, applied in every phase. */
  transitionClassName: string;
  enterClassName: string;
  leaveClassName: string;
  /** The "from" end of the animated properties — worn while entering. */
  fromClassName: string;
  /** The "to" end — worn once entered. */
  toClassName: string;
  leaveDurationMs: number;
};

/**
 * The wrapping `div` Headless UI's `Transition` used to render, with the same enter/leave classes
 * driven off {@link useTransitionPhase} instead.
 */
export function CssTransition(props: CssTransitionProps) {
  const {
    children,
    show,
    transitionClassName,
    enterClassName,
    leaveClassName,
    fromClassName,
    toClassName,
    leaveDurationMs,
  } = props;
  const phase = useTransitionPhase(show, leaveDurationMs);

  if (phase === "left") return null;

  return (
    <div
      inert={!show}
      className={cn(
        transitionClassName,
        phase === "entered" ? toClassName : fromClassName,
        phase === "leaving" ? leaveClassName : enterClassName
      )}
    >
      {children}
    </div>
  );
}
