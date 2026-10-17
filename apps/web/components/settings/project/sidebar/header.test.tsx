/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TLogoProps } from "@plane/types";
import { ProjectSettingsSidebarHeader } from "./header";

const mocks = vi.hoisted(() => ({ logo: undefined as TLogoProps | undefined }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ getProjectRoleByWorkspaceSlugAndProjectId: () => 20 }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ currentWorkspace: { slug: "test" } }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getPartialProjectById: () => ({ name: "Delivery", logo_props: mocks.logo }) }),
}));
vi.mock("use-font-face-observer", () => ({ default: () => true }));

it.each([undefined, {} as TLogoProps, { in_use: "icon", icon: {} } as TLogoProps])(
  "shows the default project glyph in settings for empty logo %j",
  (logo) => {
    mocks.logo = logo;
    const { container } = render(<ProjectSettingsSidebarHeader projectId="project" />);
    const slot = container.querySelector("[data-project-sidebar-logo]");
    const glyph = slot?.querySelector("svg");
    expect(glyph).toBeTruthy();
    expect(glyph?.style.width).toBe("20px");
    expect(glyph?.style.height).toBe("20px");
    expect(screen.getByText("Delivery")).toBeTruthy();
  }
);

it("keeps a configured emoji in the settings project slot", () => {
  mocks.logo = { in_use: "emoji", emoji: { value: "128640" } };
  const { container } = render(<ProjectSettingsSidebarHeader projectId="project" />);
  const slot = container.querySelector("[data-project-sidebar-logo]");
  expect(slot?.textContent).toBe(String.fromCodePoint(128640));
  expect(slot?.querySelector("svg")).toBeNull();
});
