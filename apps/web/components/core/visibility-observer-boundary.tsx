import type { ReactNode, TransitionEvent } from "react";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
// local imports
import { createVisibilityUpdateQueue } from "./visibility-update-queue";

const VisibilityUpdates = createContext<ReturnType<typeof createVisibilityUpdateQueue> | null>(null);
export const useVisibilityUpdates = () => useContext(VisibilityUpdates);

export function VisibilityObserverBoundary({ children }: { children: ReactNode }) {
  const [queue] = useState(createVisibilityUpdateQueue);
  return <VisibilityUpdates.Provider value={queue}>{children}</VisibilityUpdates.Provider>;
}

export function useCollapsibleVisibilityUpdates(open: boolean) {
  const queue = useVisibilityUpdates();
  const previousOpen = useRef(open);
  const finish = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    if (previousOpen.current === open) return;
    previousOpen.current = open;
    if (!queue || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const resume = queue.pause();
    // Also release for empty panels, canceled motion, or background tabs without transition events.
    const timeout = window.setTimeout(() => finish.current?.(), 300);
    const complete = () => {
      window.clearTimeout(timeout);
      if (finish.current === complete) finish.current = undefined;
      resume();
    };
    finish.current = complete;
    return complete;
  }, [open, queue]);

  return (event: TransitionEvent) => {
    if (event.target === event.currentTarget && event.propertyName === "height") finish.current?.();
  };
}
