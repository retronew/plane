import type { ReactNode } from "react";

/** Keep the state icon identical in the list and inline editor. */
export function StateIconFrame({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-layer-1"
      style={color ? { backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
    >
      {children}
    </span>
  );
}
