/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectViewsPage from "./page";

const mocks = vi.hoisted(() => ({
  enabled: false,
  admin: true,
  push: vi.fn(),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getProjectById: () => ({ name: "Example" }),
    currentProjectDetails: { issue_views_view: mocks.enabled },
  }),
}));
vi.mock("@/hooks/store/use-project-view", () => ({
  useProjectView: () => ({ filters: {}, updateFilters: vi.fn(), clearAllFilters: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => mocks.admin }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/views/views-list", () => ({
  ProjectViewsList: () => <section aria-label="Project views list" />,
}));
vi.mock("@/components/views/applied-filters", () => ({ ViewAppliedFiltersList: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = false;
  mocks.admin = true;
});
function setup() {
  return render(
    <ProjectViewsPage
      {...({ params: { workspaceSlug: "workspace", projectId: "project" } } as ComponentProps<typeof ProjectViewsPage>)}
    />
  );
}

it("shows the compact SVG feature-disabled state on a direct URL and routes administrators to feature settings", async () => {
  const { container } = setup();
  expect(screen.getByRole("heading", { name: "disabled_project.empty_state.view.title" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Project views list" })).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  const manage = screen.getByRole("button", { name: "disabled_project.empty_state.view.primary_button.text" });
  fireEvent.click(manage);
  expect(mocks.push).toHaveBeenCalledWith("/workspace/settings/projects/project/features/views");
});

it("does not let non-administrators enable the feature", () => {
  mocks.admin = false;
  setup();
  const manage = screen.getByRole("button", { name: "disabled_project.empty_state.view.primary_button.text" });
  expect((manage as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(manage);
  expect(mocks.push).not.toHaveBeenCalled();
});

it("renders the regular project views list when the feature is enabled", () => {
  mocks.enabled = true;
  setup();
  expect(screen.getByRole("region", { name: "Project views list" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "disabled_project.empty_state.view.title" })).toBeNull();
});
