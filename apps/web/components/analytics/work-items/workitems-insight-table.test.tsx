import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import WorkItemsInsightTable from "./workitems-insight-table";
const mocks = vi.hoisted(() => ({ get: vi.fn(), peek: false }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAdvanceAnalyticsStats = mocks.get;
  },
}));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({ selectedProjects: [], isPeekView: mocks.peek }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Project", logo_props: {} }) }),
}));
beforeEach(async () => {
  mocks.peek = false;
  await setLanguage("zh-CN");
  mocks.get.mockResolvedValue([
    {
      project_id: "p1",
      project__name: "Project",
      backlog_work_items: 1,
      started_work_items: 0,
      un_started_work_items: 0,
      completed_work_items: 0,
      cancelled_work_items: 0,
    },
  ]);
});
function View() {
  return (
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <WorkItemsInsightTable />
      </SWRConfig>
    </MemoryRouter>
  );
}
it("renders a fallback project icon and a real project link for an empty logo object", async () => {
  render(<View />);
  const link = await screen.findByRole("link", { name: "Project" });
  expect(link.getAttribute("href")).toBe("/test/projects/p1/issues/");
  expect(link.querySelector("svg")).toBeTruthy();
});
it("links real assignees and leaves unassigned rows non-interactive", async () => {
  mocks.peek = true;
  mocks.get.mockResolvedValue([
    { display_name: "Ada", assignee_id: "u1", avatar_url: "", completed_work_items: 1 },
    { display_name: "", completed_work_items: 0 },
  ]);
  render(<View />);
  const link = await screen.findByRole("link", { name: /Ada/ });
  expect(link.getAttribute("href")).toBe("/test/profile/u1/");
  expect(screen.getByText("未分配").closest("a")).toBeNull();
});
