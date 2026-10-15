import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import type { IUserProfileData } from "@plane/types";
import { ProfileStats } from "./stats";
import { ProfileWorkload } from "./workload";
import { ProfileStateDistribution } from "./state-distribution";
import { ProfilePriorityDistribution } from "./priority-distribution";

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", userId: "user" }) }));
vi.mock("@plane/blocks/charts/bar-chart", () => ({
  BarChart: ({ data }: { data: unknown }) => <pre data-testid="priority-data">{JSON.stringify(data)}</pre>,
}));
vi.mock("@plane/blocks/charts/pie-chart", () => ({
  PieChart: ({ data }: { data: unknown }) => <pre data-testid="state-data">{JSON.stringify(data)}</pre>,
}));
vi.mock("@plane/blocks/empty-state", () => ({ EmptyStateCompact: ({ title }: { title: string }) => <p>{title}</p> }));
const profile: IUserProfileData = {
  assigned_issues: 2,
  created_issues: 4,
  subscribed_issues: 6,
  completed_issues: 1,
  pending_issues: 1,
  priority_distribution: [],
  state_distribution: [],
};
it("keeps statistics linked to the matching profile views, including zero counts", () => {
  render(
    <MemoryRouter>
      <ProfileStats userProfile={{ ...profile, assigned_issues: 0 }} />
    </MemoryRouter>
  );
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/workspace/profile/user/created/",
    "/workspace/profile/user/assigned/",
    "/workspace/profile/user/subscribed/",
  ]);
  expect(links.map((link) => link.lastElementChild?.lastElementChild?.textContent)).toEqual(["4", "0", "6"]);
});
it("renders every supplied workload group without removing empty groups", () => {
  render(
    <ProfileWorkload
      stateDistribution={[
        { state_group: "unstarted", state_count: 0 },
        { state_group: "completed", state_count: 3 },
      ]}
    />
  );
  expect(screen.getByText("web.not_started")).toBeTruthy();
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
});
it("uses the correct distinct empty state for each distribution", () => {
  render(
    <>
      <ProfilePriorityDistribution userProfile={profile} />
      <ProfileStateDistribution userProfile={profile} stateDistribution={[]} />
    </>
  );
  expect(screen.getByText("workspace_empty_state.your_work_by_state.title")).toBeTruthy();
  expect(screen.getByText("workspace_empty_state.your_work_by_priority.title")).toBeTruthy();
});
it("passes real counts and localized labels to the charts", () => {
  const populated: IUserProfileData = {
    ...profile,
    priority_distribution: [{ priority: "urgent", priority_count: 2 }],
    state_distribution: [{ state_group: "unstarted", state_count: 3 }],
  };
  render(
    <>
      <ProfilePriorityDistribution userProfile={populated} />
      <ProfileStateDistribution userProfile={populated} stateDistribution={populated.state_distribution} />
    </>
  );
  expect(JSON.parse(screen.getByTestId("priority-data").textContent!)[0]).toMatchObject({ name: "urgent", count: 2 });
  expect(JSON.parse(screen.getByTestId("state-data").textContent!)[0]).toMatchObject({
    name: "web.unstarted",
    value: 3,
  });
});
