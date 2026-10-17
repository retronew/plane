import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectViewsHeader } from "./header";

const mocks = vi.hoisted(() => ({
  project: { issue_views_view: true } as { issue_views_view?: boolean } | undefined,
  toggleCreateViewModal: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ loader: undefined, getPartialProjectById: () => mocks.project }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({ useCommandPalette: () => mocks }));
vi.mock("@/components/breadcrumbs/use-project-crumb-props", () => ({ useProjectCrumbProps: () => ({}) }));
vi.mock("@/components/breadcrumbs/common", () => ({ CommonProjectBreadcrumbs: () => <span>Project breadcrumb</span> }));
vi.mock("@/components/common/breadcrumb-link", () => ({
  BreadcrumbLink: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("@plane/blocks/breadcrumb", () => ({
  Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => <nav>{children}</nav>, {
    Item: ({ component }: { component: ReactNode }) => component,
  }),
}));
vi.mock("@/components/views/view-list-header", () => ({ ViewListHeader: () => <span>View search and sort</span> }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.project = { issue_views_view: true };
});

it.each([undefined, {}, { issue_views_view: false }])(
  "keeps breadcrumbs and hides view controls unless enabled: %j",
  (project) => {
    mocks.project = project;
    render(<ProjectViewsHeader />);
    expect(screen.getByText("Project breadcrumb")).toBeTruthy();
    expect(screen.getByText("web.views")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "web.add_view" })).toBeNull();
    expect(screen.queryByText("View search and sort")).toBeNull();
  }
);

it("shows controls and opens creation for an enabled project", () => {
  render(<ProjectViewsHeader />);
  expect(screen.getByText("View search and sort")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "web.add_view" }));
  expect(mocks.toggleCreateViewModal).toHaveBeenCalledWith(true);
});
