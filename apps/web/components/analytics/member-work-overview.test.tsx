import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { MemberWorkOverview } from "./member-work-overview";
// The mocked store below is plain data; rerenders stand in for MobX notifications.
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
import type { MemberWorkItem, MemberWorkRow } from "@/services/member-work.service";
const mocks = vi.hoisted(() => ({ overview: vi.fn(), detail: vi.fn(), projects: ["p1"] }));
vi.mock("@/services/member-work.service", async (original) => ({
  ...(await original<object>()),
  MemberWorkService: class {
    getOverview = mocks.overview;
    getMember = mocks.detail;
  },
}));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({ selectedProjects: mocks.projects, selectedDuration: "last_month" }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${Object.values(params).join(" ")}` : key),
  }),
}));
vi.mock("@plane/blocks/property-select", () => ({
  DateRangeSelect: ({ onChange }: { onChange: (range: { from: Date; to: Date }) => void }) => (
    <button onClick={() => onChange({ from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) })}>Pick deadline</button>
  ),
}));
const row: MemberWorkRow = {
  id: "u1",
  name: "Ada",
  avatar_url: null,
  project_count: 1,
  projects: [{ id: "p1", name: "Project A" }],
  assigned: 5,
  unstarted: 1,
  started: 1,
  completed: 2,
  cancelled: 1,
  overdue: 1,
  late_completed: 1,
  justified: 1,
  unjustified: 1,
  unreviewed: 3,
};
const item: MemberWorkItem = {
  id: "i1",
  name: "Fix it",
  sequence_id: 42,
  project_id: "p1",
  project_name: "Project A",
  project_identifier: "TASK",
  target_date: "2026-01-10",
  completed_at: null,
  state_name: "In progress",
  state_group: "started",
  reason_status: "justified",
  reason_comment_id: "c1",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.projects = ["p1"];
  mocks.overview.mockResolvedValue({ rows: [row] });
  mocks.detail.mockResolvedValue({ results: [item], count: 21, next_page: 2 });
});
function View() {
  return (
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <MemberWorkOverview />
      </SWRConfig>
    </MemoryRouter>
  );
}
async function drill(status = "assigned", count = 5) {
  fireEvent.click(
    await screen.findByRole("button", { name: `web.member_work_drill Ada web.member_work_${status} ${count}` })
  );
  await screen.findByRole("link", { name: "TASK-42 Fix it" });
}
it("renders counts without fetching all tasks and expands real project links", async () => {
  render(<View />);
  expect((await screen.findByRole("link", { name: /Ada/ })).getAttribute("href")).toBe("/workspace/profile/u1/");
  expect(mocks.overview).toHaveBeenCalledWith("workspace", { projectIds: ["p1"] });
  expect(mocks.detail).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.member_work_projects_for Ada 1" }));
  expect(screen.getByRole("link", { name: "Project A" }).getAttribute("href")).toBe("/workspace/projects/p1/issues/");
  expect(screen.getAllByRole("columnheader")).toHaveLength(12);
});
it.each([
  ["assigned", 5, "all"],
  ["overdue", 1, "overdue"],
  ["late_completed", 1, "late_completed"],
  ["justified", 1, "justified"],
  ["unjustified", 1, "unjustified"],
  ["unreviewed", 3, "unreviewed"],
] as const)("drills %s using the exact API status and real links", async (metric, count, status) => {
  render(<View />);
  await drill(metric, count);
  expect(mocks.detail).toHaveBeenLastCalledWith("workspace", "u1", { projectIds: ["p1"] }, status, 1);
  expect(screen.getByRole("link", { name: "TASK-42 Fix it" }).getAttribute("href")).toBe("/workspace/browse/TASK-42/");
  expect(screen.getByRole("link", { name: "web.member_work_justified" }).getAttribute("href")).toBe(
    "/workspace/browse/TASK-42/#comment-c1"
  );
});
it("uses next_page and disables next at the end; returning preserves deadline filters", async () => {
  render(<View />);
  fireEvent.click(screen.getByRole("button", { name: "Pick deadline" }));
  await waitFor(() =>
    expect(mocks.overview).toHaveBeenLastCalledWith("workspace", {
      projectIds: ["p1"],
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    })
  );
  await drill();
  mocks.detail.mockResolvedValue({ results: [item], count: 21, next_page: null });
  fireEvent.click(screen.getByRole("button", { name: "web.member_work_next" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "web.member_work_next" }).hasAttribute("disabled")).toBe(true)
  );
  expect(mocks.detail).toHaveBeenLastCalledWith(
    "workspace",
    "u1",
    expect.objectContaining({ startDate: "2026-01-01", endDate: "2026-01-31" }),
    "all",
    2
  );
  fireEvent.click(screen.getByRole("button", { name: "web.member_work_back" }));
  await drill();
  expect(mocks.detail).toHaveBeenLastCalledWith(
    "workspace",
    "u1",
    expect.objectContaining({ startDate: "2026-01-01" }),
    "all",
    1
  );
});
it("clears selection and paging immediately when project scope changes", async () => {
  const view = render(<View />);
  await drill();
  mocks.projects = ["p2"];
  mocks.overview.mockImplementation(() => new Promise(() => {}));
  view.rerender(<View />);
  expect(screen.queryByRole("link", { name: "TASK-42 Fix it" })).toBeNull();
  expect(screen.queryByRole("link", { name: /Ada/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "web.member_work_back" })).toBeNull();
  await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith("workspace", { projectIds: ["p2"] }));
});
it("clears selection when deadline range changes and supports clearing the range", async () => {
  render(<View />);
  await drill();
  fireEvent.click(screen.getByRole("button", { name: "Pick deadline" }));
  expect(screen.queryByRole("link", { name: "TASK-42 Fix it" })).toBeNull();
  await screen.findByRole("link", { name: /Ada/ });
  fireEvent.click(screen.getByRole("button", { name: "web.member_work_clear_range" }));
  await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith("workspace", { projectIds: ["p1"] }));
});
it("recovers overview errors using retry and renders real empty state", async () => {
  mocks.overview.mockRejectedValueOnce(new Error("offline"));
  render(<View />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: /Ada/ })).toBeNull();
  mocks.overview.mockResolvedValue({ rows: [] });
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  await screen.findByText("web.member_work_empty_members");
});
it("recovers detail errors and handles an empty page", async () => {
  mocks.detail.mockRejectedValueOnce(new Error("offline"));
  render(<View />);
  fireEvent.click(await screen.findByRole("button", { name: "web.member_work_drill Ada web.member_work_assigned 5" }));
  await screen.findByRole("alert");
  mocks.detail.mockResolvedValue({ results: [], count: 0, next_page: null });
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  await screen.findByText("web.member_work_empty_tasks");
  expect(screen.getByRole("button", { name: "web.member_work_next" }).hasAttribute("disabled")).toBe(true);
});
