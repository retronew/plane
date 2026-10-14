/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";
import { LUCIDE_ICONS_LIST } from "./lucide-icons";

// lucide-react v1 dropped these; project logos saved before the upgrade still name them.
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
  it.each(BRAND_ICON_NAMES)("still renders the %s brand icon", (name) => {
    expect(LUCIDE_ICONS_LIST.some((icon) => icon.name === name)).toBe(true);

    const { container } = render(
      <Logo logo={{ in_use: "icon", icon: { name, color: "#ff0000" } }} type="lucide" size={16} />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll("path, rect, circle, line, polygon, polyline").length).toBeGreaterThan(0);
  });

  it("gives every listed icon a unique name", () => {
    const names = LUCIDE_ICONS_LIST.map((icon) => icon.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
