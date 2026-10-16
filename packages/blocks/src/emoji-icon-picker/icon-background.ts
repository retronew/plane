import type { CSSProperties } from "react";
import type { Logo } from "../types/logo";

/** A 12.5% tint, composited over the current theme surface rather than over a cover image. */
export function getIconBackgroundStyle(logo?: Logo): CSSProperties | undefined {
  const background = logo?.in_use === "icon" ? logo.icon?.background_color : undefined;
  if (background === "transparent") return { backgroundColor: "transparent" };
  if (background && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(background)) return { backgroundColor: background };
  const color = logo?.in_use === "icon" ? logo.icon?.color : undefined;
  if (!color || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) return undefined;
  return { backgroundColor: `color-mix(in srgb, ${color} 12.5%, var(--background-color-layer-2))` };
}
