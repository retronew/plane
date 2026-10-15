import type { ReactNode, TransitionEvent } from "react";
import { createContext, startTransition, useContext, useLayoutEffect, useRef, useState } from "react";

/** Height transitions move many virtual rows at once. Apply their latest visibility after motion. */
export function createVisibilityUpdateQueue() {
  const locks = new Set<symbol>();
  const pending = new Map<Element, () => void>();
  return {
    schedule(target: Element, update: () => void) {
      if (locks.size) pending.set(target, update);
      else startTransition(update);
    },
    cancel(target: Element) {
      pending.delete(target);
    },
    pause() {
      const lock = Symbol();
      locks.add(lock);
      return () => {
        if (!locks.delete(lock) || locks.size) return;
        const updates = [...pending.values()];
        pending.clear();
        startTransition(() => updates.forEach((update) => update()));
      };
    },
  };
}

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
