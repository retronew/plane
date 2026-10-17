/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LogoProps } from "./logo";
import { Logo } from "./logo";
import { ProjectLogo } from "./project-logo";

vi.mock("use-font-face-observer", () => ({ default: () => true }));

describe("ProjectLogo", () => {
  it.each([
    undefined,
    null,
    {},
    { in_use: "emoji", emoji: {} },
    { in_use: "emoji", emoji: { value: "" } },
    { in_use: "icon", icon: { color: "#ff0000" } },
    { in_use: "icon", icon: { name: "" } },
  ])("renders a project glyph for missing or empty configuration %j", (logo) => {
    const { container } = render(<ProjectLogo logo={logo as LogoProps["logo"]} size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.style.width).toBe("24px");
    expect(svg?.style.height).toBe("24px");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".bg-layer-1")).toBeNull();
  });

  it.each<LogoProps>([
    { logo: { in_use: "emoji", emoji: { value: "128640", url: "/emoji.png" } }, size: 20 },
    { logo: { in_use: "icon", icon: { name: "home", color: "#123456", background_color: "#ffffff" } } },
    { logo: { in_use: "icon", icon: { name: "home", color: "#123456" } }, background: false, size: 28 },
    { logo: { in_use: "icon", icon: { name: "Github", color: "#123456" } }, type: "lucide" },
  ])("preserves configured Logo rendering and options %j", (props) => {
    const project = render(<ProjectLogo {...props} />);
    const generic = render(<Logo {...props} />);
    expect(project.container.innerHTML).toBe(generic.container.innerHTML);
  });

  it("does not change the generic empty logo used by other entities", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".bg-layer-1")).not.toBeNull();
  });
});
