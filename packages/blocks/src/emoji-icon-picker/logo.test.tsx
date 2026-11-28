/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo } from "./logo";
import { LUCIDE_ICONS_LIST } from "./lucide-icons";
import { resetMaterialSymbolsFontCacheForTests } from "./use-material-font";

let mockFontLoaded = true;
// lucide-react v1 dropped these; project logos saved before the upgrade still name them.
// Lucide SVG rendering does not need a font load or its browser polling timers.
vi.mock("use-font-face-observer", () => ({ default: () => mockFontLoaded }));

afterEach(() => {
  mockFontLoaded = true;
  resetMaterialSymbolsFontCacheForTests();
  vi.restoreAllMocks();
});

const BRAND_ICON_NAMES = [
  "Codepen",
  "Codesandbox",
  "Dribbble",
  "Facebook",
  "Figma",
  "Framer",
  "Github",
  "Gitlab",
  "Instagram",
  "Linkedin",
];

describe("Logo with a lucide icon", () => {
  it.each(BRAND_ICON_NAMES)("still renders the %s brand icon", async (name) => {
    expect(LUCIDE_ICONS_LIST.some((icon) => icon.name === name)).toBe(true);

    const { container } = render(
      <Logo logo={{ in_use: "icon", icon: { name, color: "#ff0000" } }} type="lucide" size={16} />
    );
    await waitFor(() => {
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.querySelectorAll("path, rect, circle, line, polygon, polyline").length).toBeGreaterThan(0);
    });
  });

  it("gives every listed icon a unique name", () => {
    const names = LUCIDE_ICONS_LIST.map((icon) => icon.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("Logo placeholder and layout shift prevention", () => {
  it("reserves exact fixed dimensions with inline-block shrink-0 while Material font is loading", () => {
    mockFontLoaded = false;
    resetMaterialSymbolsFontCacheForTests();

    const { container } = render(
      <Logo logo={{ in_use: "icon", icon: { name: "rocket_launch", color: "#3b82f6" } }} size={20} />
    );

    const placeholder = container.querySelector<HTMLElement>("[data-logo-placeholder]");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.className).toContain("inline-block");
    expect(placeholder?.className).toContain("shrink-0");
    expect(placeholder?.style.width).toBe("20px");
    expect(placeholder?.style.height).toBe("20px");
    expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders Material icon immediately when document.fonts already has the font ready", () => {
    mockFontLoaded = false;
    resetMaterialSymbolsFontCacheForTests();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { check: vi.fn(() => true) },
    });

    const { container } = render(
      <Logo logo={{ in_use: "icon", icon: { name: "home", color: "#5e6ad2" } }} size={16} />
    );

    const glyph = container.querySelector<HTMLElement>(".material-symbols-rounded");
    expect(glyph).not.toBeNull();
    expect(glyph?.style.overflow).toBe("hidden");
    expect(glyph?.style.width).toBe("16px");
    expect(glyph?.style.height).toBe("16px");
  });

  it("renders emoji icons as shrink-proof inline-flex boxes", () => {
    const { container } = render(<Logo logo={{ in_use: "emoji", emoji: { value: "128640" } }} size={18} />);
    const emojiEl = container.firstElementChild as HTMLElement | null;
    expect(emojiEl?.className).toContain("inline-flex");
    expect(emojiEl?.className).toContain("shrink-0");
    expect(emojiEl?.style.width).toBe("18px");
    expect(emojiEl?.style.height).toBe("18px");
  });
});
