/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Due to some weird issue with the import order, the import of useFontFaceObserver
// should be after the imported here rather than some below helper functions as it is in the original file

import type { ReactNode } from "react";
import { getIconBackgroundStyle } from "./icon-background";
import useFontFaceObserver from "use-font-face-observer";
// types
import type { Logo as LogoType } from "../types/logo";
// local imports
import { getEmojiSize, stringToEmoji } from "./helper";
import { LUCIDE_ICONS_LIST } from "./lucide-icons";

export type LogoProps = {
  logo?: LogoType;
  size?: number;
  background?: boolean;
  type?: "lucide" | "material";
};

export function Logo({ logo, size = 16, background = true, type = "material" }: LogoProps) {
  const isMaterialSymbolsFontLoaded = useFontFaceObserver([
    {
      family: "Material Symbols Rounded",
      style: "normal",
      weight: "normal",
      stretch: "condensed",
    },
  ]);

  // Reusable loading skeleton
  const loadingSkeleton = <span style={{ height: size, width: size }} className="rounded-sm bg-layer-1" />;

  // Early returns for loading/empty states
  if (!logo || !logo.in_use) return loadingSkeleton;

  const { in_use, emoji, icon } = logo;
  const value = in_use === "emoji" ? emoji?.value : icon?.name;

  if (!value) return loadingSkeleton;

  // Emoji rendering
  if (in_use === "emoji") {
    return (
      <span
        className="flex items-center justify-center"
        style={{
          fontSize: `${getEmojiSize(size)}rem`,
          lineHeight: `${getEmojiSize(size)}rem`,
          height: size,
          width: size,
        }}
      >
        {stringToEmoji(emoji?.value || "")}
      </span>
    );
  }

  // Icon rendering
  if (in_use === "icon") {
    const color = icon?.color;
    const backgroundStyle = background ? getIconBackgroundStyle(logo) : undefined;
    const hasBackground = backgroundStyle && backgroundStyle.backgroundColor !== "transparent";
    const glyphSize = hasBackground ? size * 0.82 : size;
    const frame = (glyph: ReactNode) => (
      <span
        data-logo-icon=""
        className="inline-flex shrink-0 items-center justify-center"
        style={{ ...backgroundStyle, width: size, height: size, borderRadius: Math.max(3, size * 0.2) }}
      >
        {glyph}
      </span>
    );

    // Lucide icon
    if (type === "lucide") {
      const lucideIcon = LUCIDE_ICONS_LIST.find((item) => item.name === value);
      if (!lucideIcon) return null;

      const LucideIconElement = lucideIcon.element;
      return frame(<LucideIconElement style={{ color, height: glyphSize, width: glyphSize }} />);
    }

    if (!isMaterialSymbolsFontLoaded) return loadingSkeleton;

    // Material icon
    return frame(
      <span
        className="material-symbols-rounded"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          flexShrink: 0,
          lineHeight: 1,
          fontSize: glyphSize,
          color,
          scale: hasBackground ? undefined : "115%",
        }}
      >
        {value}
      </span>
    );
  }

  return null;
}
