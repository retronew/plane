/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Due to some weird issue with the import order, the import of useFontFaceObserver
// should be after the imported here rather than some below helper functions as it is in the original file

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { getIconBackgroundStyle } from "./icon-background";
// types
import type { Logo as LogoType } from "../types/logo";
// local imports
import { getEmojiSize, stringToEmoji } from "./helper";
import { useMaterialSymbolsFontLoaded } from "./use-material-font";

type LucideIconItem = { name: string; element: ComponentType<{ style?: CSSProperties }> };
let cachedLucideIcons: LucideIconItem[] | null = null;
let lucideIconsPromise: Promise<LucideIconItem[]> | null = null;

function loadLucideIcons(): Promise<LucideIconItem[]> {
  if (cachedLucideIcons) return Promise.resolve(cachedLucideIcons);
  if (!lucideIconsPromise) {
    lucideIconsPromise = import("./lucide-icons").then((mod) => {
      cachedLucideIcons = mod.LUCIDE_ICONS_LIST;
      return cachedLucideIcons;
    });
  }
  return lucideIconsPromise;
}

function LazyLucideGlyph({ name, color, size }: { name: string; color?: string; size: number }) {
  const [icons, setIcons] = useState<LucideIconItem[] | null>(() => cachedLucideIcons);

  useEffect(() => {
    if (icons) return;
    let mounted = true;
    void loadLucideIcons().then((list) => {
      if (mounted) setIcons(list);
      return undefined;
    });
    return () => {
      mounted = false;
    };
  }, [icons]);

  const lucideIcon = icons?.find((item) => item.name === name);
  if (!lucideIcon) {
    if (!icons) {
      return (
        <span
          aria-hidden="true"
          data-logo-placeholder=""
          className="inline-block shrink-0 rounded-xs bg-layer-1 motion-safe:animate-pulse"
          style={{ height: size, width: size }}
        />
      );
    }
    return null;
  }

  const LucideIconElement = lucideIcon.element;
  return <LucideIconElement style={{ color, height: size, width: size }} />;
}

export type LogoProps = {
  logo?: LogoType;
  size?: number;
  background?: boolean;
  type?: "lucide" | "material";
};

type RenderIconLogoProps = {
  logo: LogoType;
  size: number;
  background: boolean;
  type: "lucide" | "material";
  value: string;
  isMaterialSymbolsFontLoaded: boolean;
  loadingSkeleton: ReactNode;
};

function renderIconLogo({
  logo,
  size,
  background,
  type,
  value,
  isMaterialSymbolsFontLoaded,
  loadingSkeleton,
}: RenderIconLogoProps) {
  const color = logo.icon?.color;
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

  // Lucide icon (dynamically loaded so 317 lucide-react icons stay out of initial bundles)
  if (type === "lucide") {
    return frame(<LazyLucideGlyph name={value} color={color} size={glyphSize} />);
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
        overflow: "hidden",
        whiteSpace: "nowrap",
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

export function Logo({ logo, size = 16, background = true, type = "material" }: LogoProps) {
  const isMaterialSymbolsFontLoaded = useMaterialSymbolsFontLoaded();

  // Fixed-box placeholder: inline-block + shrink-0 reserves exact size x size so adjacent text never shifts.
  const loadingSkeleton = (
    <span
      aria-hidden="true"
      data-logo-placeholder=""
      style={{ height: size, width: size, borderRadius: Math.max(3, size * 0.2) }}
      className="inline-block shrink-0 rounded-sm bg-layer-1 motion-safe:animate-pulse"
    />
  );

  // Early returns for loading/empty states
  if (!logo || !logo.in_use) return loadingSkeleton;

  const { in_use, emoji, icon } = logo;
  const value = in_use === "emoji" ? emoji?.value : icon?.name;

  if (!value) return loadingSkeleton;

  // Emoji rendering
  if (in_use === "emoji") {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden"
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
    return renderIconLogo({
      logo,
      size,
      background,
      type,
      value,
      isMaterialSymbolsFontLoaded,
      loadingSkeleton,
    });
  }

  return loadingSkeleton;
}
