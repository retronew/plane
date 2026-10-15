import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia?.(query);
  if (!media) return () => {};
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
/** Shared timing avoids Recharts' 1.5 second defaults and respects live accessibility changes. */
export function useChartMotion() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => true
  );
  return {
    isAnimationActive: !reduced,
    animationDuration: 300,
    animationBegin: 0,
    animationEasing: "ease-out" as const,
  };
}
