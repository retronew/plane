import type { ReactNode } from "react";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProjectOverviewHeader } from "./header";

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ loader: undefined }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/layout", () => {
  const Container = ({ children }: { children: ReactNode }) => children;
  return { Header: Object.assign(Container, { LeftItem: Container, RightItem: Container }) };
});
vi.mock("@plane/blocks/breadcrumb", () => ({
  Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => children, { Item: () => null }),
}));
vi.mock("@/components/common/breadcrumb-link", () => ({ BreadcrumbLink: () => null }));
vi.mock("@/components/breadcrumbs/common", () => ({ CommonProjectBreadcrumbs: () => null }));
vi.mock("@/components/breadcrumbs/use-project-crumb-props", () => ({ useProjectCrumbProps: () => ({}) }));

it.each([true, false])("reflects sidebar visibility when initially open is %s and after toggling", (initialOpen) => {
  const onToggleSidebar = vi.fn();
  function HeaderWithSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(initialOpen);
    return (
      <ProjectOverviewHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => {
          onToggleSidebar();
          setSidebarOpen((open) => !open);
        }}
      />
    );
  }

  render(<HeaderWithSidebar />);
  const toggle = screen.getByRole("button", { name: "web.toggle_sidebar" });
  const expectSidebarState = (open: boolean) => {
    expect(toggle.classList.contains("bg-layer-3")).toBe(open);
    expect(toggle.classList.contains("bg-layer-transparent")).toBe(!open);
    expect(toggle.getAttribute("aria-pressed")).toBe(String(open));
    expect(toggle.getAttribute("aria-expanded")).toBe(String(open));
    expect(toggle.getAttribute("aria-controls")).toBe("project-overview-sidebar");
  };

  expectSidebarState(initialOpen);
  fireEvent.click(toggle);
  expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  expectSidebarState(!initialOpen);
  fireEvent.click(toggle);
  expect(onToggleSidebar).toHaveBeenCalledTimes(2);
  expectSidebarState(initialOpen);
});
