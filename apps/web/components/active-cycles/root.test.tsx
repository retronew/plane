import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import type { IWorkspaceActiveCyclesResponse } from "@plane/types";
import { WorkspaceActiveCycles } from "./root";
import { cycleFixture } from "./fixtures.test-support";

const state = vi.hoisted(() => ({ slug: "first", allowed: true, fetch: vi.fn() }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: state.slug }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.allowed }) }));
vi.mock("@/services/cycle.service", () => ({
  CycleService: class {
    workspaceActiveCycles = state.fetch;
  },
}));
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateDetailed: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("./cycle-card", () => ({
  WorkspaceCycleCard: ({ cycle, workspaceSlug }: { cycle: typeof cycleFixture; workspaceSlug: string }) => (
    <div>
      {workspaceSlug}:{cycle.name}
    </div>
  ),
}));
const page = (names: string[], more = false): IWorkspaceActiveCyclesResponse => ({
  count: names.length,
  extra_stats: null,
  next_cursor: "10:1:0",
  next_page_results: more,
  prev_cursor: "10:-1:1",
  prev_page_results: false,
  total_pages: more ? 2 : 1,
  results: names.map((name) => ({ ...cycleFixture, id: name, name })),
});
const Tree = () => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <WorkspaceActiveCycles />
  </SWRConfig>
);
beforeEach(() => {
  state.slug = "first";
  state.allowed = true;
  state.fetch.mockReset();
});

it("loads pages independently and does not show old workspace cycles during navigation", async () => {
  state.fetch.mockImplementation((workspace: string, cursor: string) =>
    Promise.resolve(
      workspace === "second" ? page(["Second"]) : cursor === "10:0:0" ? page(["One"], true) : page(["Two"])
    )
  );
  const { rerender } = render(<Tree />);
  expect(await screen.findByText("first:One")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "load_more" }));
  expect(await screen.findByText("first:Two")).toBeTruthy();
  expect(state.fetch).toHaveBeenCalledWith("first", "10:1:0", 10);
  state.slug = "second";
  rerender(<Tree />);
  expect(screen.queryByText("first:One")).toBeNull();
  expect(await screen.findByText("second:Second")).toBeTruthy();
});
it("shows retry after failure and recovers to an empty state without an automatic retry loop", async () => {
  state.fetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page([]));
  render(<Tree />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(state.fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "web.retry" }));
  expect(await screen.findByText("workspace_cycles.empty_title")).toBeTruthy();
});
it("blocks guests without fetching and removes cached data after permission revocation", async () => {
  state.fetch.mockResolvedValue(page(["Private"]));
  const { rerender } = render(<Tree />);
  expect(await screen.findByText("first:Private")).toBeTruthy();
  state.allowed = false;
  rerender(<Tree />);
  expect(screen.queryByText("first:Private")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("permission_denied");
  await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(1));
});
it("does not retain cached cycle cards when the API returns forbidden", async () => {
  state.fetch.mockRejectedValue(Object.assign(new Error("denied"), { isAxiosError: true, response: { status: 403 } }));
  render(<Tree />);
  expect((await screen.findByRole("alert")).textContent).toContain("permission_denied");
  expect(screen.queryByRole("button", { name: "web.retry" })).toBeNull();
});
