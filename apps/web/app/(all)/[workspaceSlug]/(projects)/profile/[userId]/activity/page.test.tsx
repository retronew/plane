import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";

const scenario = vi.hoisted(() => ({ cursors: [] as string[] }));
const pages: Record<string, { total_pages: number; results: { id: string }[] }> = {
  "100:0:0": { total_pages: 2, results: [{ id: "a" }] },
  "100:1:0": { total_pages: 2, results: [{ id: "b" }] },
};

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", userId: "u1" }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    async getUserProfileActivity(_workspaceSlug: string, _userId: string, { cursor }: { cursor: string }) {
      scenario.cursors.push(cursor);
      return pages[cursor];
    }
  },
}));
vi.mock("@/components/profile/activity/activity-list", () => ({
  ActivityList: ({ activity }: { activity?: { results: { id: string }[] } }) => (
    <div data-testid="list">{activity?.results.map((result) => result.id).join(",")}</div>
  ),
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/profile/activity/download-button", () => ({ DownloadActivityButton: () => null }));

import ProfileActivityPage from "./page";

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ProfileActivityPage />
    </SWRConfig>
  );

beforeEach(async () => {
  scenario.cursors.length = 0;
  await setLanguage("en");
});

it("drives load more from the first page without a second request for it", async () => {
  renderPage();

  await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("a"));
  // The page and its first list share one SWR cache entry, so the first cursor is fetched once.
  expect(scenario.cursors).toEqual(["100:0:0"]);

  const loadMore = screen.getByRole("button", { name: "Load more" });
  fireEvent.click(loadMore);

  await waitFor(() => expect(screen.getAllByTestId("list")).toHaveLength(2));
  expect(screen.getAllByTestId("list").map((node) => node.textContent)).toEqual(["a", "b"]);
  expect(scenario.cursors).toEqual(["100:0:0", "100:1:0"]);
});

it("hides load more on the last page", async () => {
  renderPage();

  await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("a"));
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await waitFor(() => expect(screen.getAllByTestId("list")).toHaveLength(2));

  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});
