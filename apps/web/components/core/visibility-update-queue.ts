import { startTransition } from "react";

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
