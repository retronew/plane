import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { cycleFixture } from "@/components/active-cycles/fixtures.test-support";
import { ProjectActiveCycle } from "./project-active-cycle";

const mocks = vi.hoisted(() => ({
  fetchCycleDetails: vi.fn(),
  fetchProjectDetails: vi.fn(),
  fetchHistory: vi.fn(),
  historyError: false,
  canReadSnapshots: true,
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => mocks.canReadSnapshots }),
}));
vi.mock("./root", () => ({
  ActiveCycleRoot: ({ cycleId, showHeader }: { cycleId: string; showHeader: boolean }) => (
    <section aria-label={`guest-original:${showHeader}`}>
      <div>original-project-actions:{cycleId}</div>
      <div>original-progress-and-analytics:{cycleId}</div>
    </section>
  ),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({ getCycleById: () => cycleFixture, fetchCycleDetails: mocks.fetchCycleDetails }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getProjectById: () => ({ ...cycleFixture.project_detail, timezone: "UTC" }),
    fetchProjectDetails: mocks.fetchProjectDetails,
  }),
}));
vi.mock("@/services/cycle.service", () => ({
  CycleService: class {
    workspaceActiveCyclesProgressPro = mocks.fetchHistory;
  },
}));
vi.mock("swr", () => ({
  default: (key: string[] | null, fetcher: () => unknown) => {
    if (key) fetcher();
    const history = key?.[0] === "project-active-cycle-history";
    return {
      data: history ? Object.values(cycleFixture.progress_chart).filter(Boolean) : undefined,
      error: history && mocks.historyError ? new Error("network") : undefined,
      mutate: vi.fn(),
    };
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("@/components/active-cycles/cycle-card", () => ({
  WorkspaceCycleCard: ({ header, showProject }: { header: React.ReactNode; showProject: boolean }) => (
    <section aria-label={`shared-chart:${showProject}`}>{header}</section>
  ),
}));
vi.mock("@/components/cycles/list/cycles-list-item", () => ({
  CyclesListItem: ({ cycleId }: { cycleId: string }) => <div>original-project-actions:{cycleId}</div>,
}));
beforeEach(() => {
  mocks.historyError = false;
  mocks.canReadSnapshots = true;
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T20:00:00Z"));
});

it("requests the exact project and cycle history and keeps project actions in the shared card", () => {
  render(<ProjectActiveCycle workspaceSlug="demo" projectId="project-one" cycleId="cycle-one" />);
  expect(mocks.fetchHistory).toHaveBeenCalledWith("demo", "project-one", "cycle-one");
  expect(mocks.fetchCycleDetails).toHaveBeenCalledWith("demo", "project-one", "cycle-one");
  expect(screen.getByRole("region", { name: "shared-chart:false" })).toBeTruthy();
  expect(screen.getByText("original-project-actions:cycle-one")).toBeTruthy();
  vi.useRealTimers();
});

it("keeps guest analytics and actions without requesting restricted snapshot history for any explicit cycle", () => {
  mocks.canReadSnapshots = false;
  const { rerender } = render(<ProjectActiveCycle workspaceSlug="demo" projectId="project-one" cycleId="cycle-one" />);
  expect(screen.getByRole("region", { name: "guest-original:false" })).toBeTruthy();
  expect(screen.getByText("original-project-actions:cycle-one")).toBeTruthy();
  expect(screen.getByText("original-progress-and-analytics:cycle-one")).toBeTruthy();
  expect(mocks.fetchHistory).not.toHaveBeenCalled();
  expect(mocks.fetchCycleDetails).not.toHaveBeenCalled();
  rerender(<ProjectActiveCycle workspaceSlug="demo" projectId="project-one" cycleId="filtered-current-two" />);
  expect(screen.getByText("original-project-actions:filtered-current-two")).toBeTruthy();
  expect(screen.queryByText("original-project-actions:cycle-one")).toBeNull();
  expect(mocks.fetchHistory).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("shows a retry state when the snapshot request fails instead of presenting invented history", () => {
  mocks.historyError = true;
  render(<ProjectActiveCycle workspaceSlug="demo" projectId="project-one" cycleId="cycle-one" />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "web.retry" })).toBeTruthy();
  expect(screen.queryByRole("region")).toBeNull();
  vi.useRealTimers();
});
