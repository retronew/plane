/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TLoader, TProject } from "@plane/types";
import { ProjectOverviewContext } from "@/components/project/overview/context";
import ProjectOverviewPage from "./page";

const store = vi.hoisted(() => ({
  loader: "loaded" as TLoader,
  getProjectById: vi.fn<(id: string) => TProject | undefined>(),
  allowPermissions: vi.fn(() => false),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => store }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => store }));
vi.mock("@/components/project/overview/content", () => ({
  ProjectOverviewContent: ({ project, disabled }: { project: TProject; disabled: boolean }) => (
    <section>
      <h1>{project.name}</h1>
      <button disabled={disabled}>Edit overview</button>
    </section>
  ),
}));
vi.mock("@/components/project/overview/sidebar", () => ({
  ProjectOverviewSidebar: ({ project, disabled }: { project: TProject; disabled: boolean }) => (
    <aside aria-label="Properties">
      <span>{project.identifier}</span>
      <button disabled={disabled}>Edit properties</button>
    </aside>
  ),
}));
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateDetailed: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));
const project: TProject = {
  id: "project-1",
  name: "Release planning",
  identifier: "REL",
  workspace: "workspace-id",
  member_role: 20,
  sort_order: null,
  logo_props: { in_use: "emoji", emoji: { value: "128640" } },
  archived_at: null,
  cycle_view: true,
  module_view: true,
  page_view: true,
  project_updates_view: false,
  issue_views_view: true,
  inbox_view: false,
};
function page(projectId = project.id) {
  return (
    <ProjectOverviewPage
      {...({ params: { workspaceSlug: "workspace", projectId } } as ComponentProps<typeof ProjectOverviewPage>)}
    />
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  store.loader = "loaded";
  store.allowPermissions.mockReturnValue(false);
  store.getProjectById.mockReturnValue(project);
  await setLanguage("en");
});
describe("project overview", () => {
  it("renders the requested project's content and sidebar with its page title", () => {
    render(page());
    expect(store.getProjectById).toHaveBeenCalledWith(project.id);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(project.name);
    expect(screen.getByRole("complementary", { name: "Properties" }).textContent).toContain("REL");
    expect(document.title).toContain("Release planning");
    expect(document.title).toContain("Overview");
  });
  it("hides only the property panel when the header toggles it", () => {
    render(<ProjectOverviewContext.Provider value={false}>{page()}</ProjectOverviewContext.Provider>);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("heading", { name: project.name })).toBeDefined();
  });
  it.each([5, 15])("keeps role %s read-only", (role) => {
    store.getProjectById.mockReturnValue({ ...project, member_role: role as 5 | 15 });
    render(page());
    expect((screen.getByRole("button", { name: "Edit overview" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Edit properties" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("allows workspace admins to edit but keeps archived projects read-only", () => {
    store.allowPermissions.mockReturnValue(true);
    store.getProjectById.mockReturnValue({ ...project, member_role: 15 });
    const { rerender } = render(page());
    expect((screen.getByRole("button", { name: "Edit overview" }) as HTMLButtonElement).disabled).toBe(false);
    store.getProjectById.mockReturnValue({ ...project, archived_at: "2026-10-17" });
    rerender(page());
    expect((screen.getByRole("button", { name: "Edit overview" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows loading only while the missing project's store is initializing", () => {
    store.getProjectById.mockReturnValue(undefined);
    store.loader = "init-loader";
    const { rerender } = render(page());
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
    store.loader = "loaded";
    rerender(page());
    expect(screen.getByRole("heading", { name: "Project not found" })).toBeDefined();
  });
  it("clears stale details and title when the route points to a missing project", () => {
    store.getProjectById.mockImplementation((id) => (id === project.id ? project : undefined));
    const { rerender } = render(page());
    rerender(page("missing-project"));
    expect(store.getProjectById).toHaveBeenLastCalledWith("missing-project");
    expect(screen.queryByText(project.name)).toBeNull();
    expect(document.title).toBe("Overview");
  });
});
