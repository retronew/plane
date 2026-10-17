import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TPageNavigationTabs } from "@plane/types";
import { EPageStoreType } from "@/hooks/store";
import { PagesListView } from "./pages-list-view";

const mocks = vi.hoisted(() => ({
  store: {
    isAnyPageAvailable: true,
    loader: "init-loader" as string | undefined,
    filters: {},
    fetchPagesList: vi.fn(),
    getCurrentProjectPageIdsByTab: () => [],
    getCurrentProjectFilteredPageIdsByTab: () => [],
  },
  allowPermissions: vi.fn(),
}));
vi.mock("swr", () => ({ default: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/store", () => ({ EPageStoreType: { PROJECT: "PROJECT" }, usePageStore: () => mocks.store }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: mocks.allowPermissions }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { workspaceMemberIds: [] } }),
}));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/issues/issue-layouts/filters", () => ({ FiltersDropdown: () => null }));
vi.mock("./list/applied-filters", () => ({ PageAppliedFiltersList: () => null }));
vi.mock("./list/filters", () => ({ PageFiltersSelection: () => null }));
vi.mock("./list/order-by", () => ({ PageOrderByDropdown: () => null }));
vi.mock("./list/search-input", () => ({ PageSearchInput: () => null }));
vi.mock("@/components/pages/loaders/page-loader", () => ({
  PageLoader: () => <p>Loading pages</p>,
}));

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  mocks.store.isAnyPageAvailable = true;
  mocks.store.loader = "init-loader";
  mocks.allowPermissions.mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());

function fixture(pageType: TPageNavigationTabs) {
  return (
    <MemoryRouter>
      <PagesListView
        workspaceSlug="workspace"
        projectId="project"
        pageType={pageType}
        storeType={EPageStoreType.PROJECT}
      >
        <p>Page list</p>
      </PagesListView>
    </MemoryRouter>
  );
}

function expectTabs(pageType: TPageNavigationTabs) {
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.getByRole("tab", { name: `web.${pageType}` }).getAttribute("aria-selected")).toBe("true");
  for (const type of ["public", "private", "archived"]) {
    expect(screen.getByRole("tab", { name: `web.${type}` }).getAttribute("href")).toBe(
      `/workspace/projects/project/pages?type=${type}`
    );
  }
}

it.each(["public", "private", "archived"] as const)(
  "keeps all tabs mounted when loading finishes with an empty %s list",
  (pageType) => {
    const { rerender } = render(fixture(pageType));
    expectTabs(pageType);
    const tabList = screen.getByRole("tablist");
    expect(screen.getByText("Loading pages")).toBeTruthy();

    mocks.store.loader = undefined;
    mocks.store.isAnyPageAvailable = false;
    rerender(fixture(pageType));

    expectTabs(pageType);
    expect(screen.getByRole("tablist")).toBe(tabList);
    expect(screen.queryByText("Loading pages")).toBeNull();
    expect(screen.getByText("project_empty_state.pages.title")).toBeTruthy();
    expect(screen.queryByText("Page list")).toBeNull();
  }
);

it("keeps empty-state creation disabled for users without permission while showing tabs", () => {
  mocks.store.loader = undefined;
  mocks.store.isAnyPageAvailable = false;
  mocks.allowPermissions.mockReturnValue(false);
  render(fixture("public"));

  expectTabs("public");
  expect(
    (screen.getByRole("button", { name: "project_empty_state.pages.cta_primary" }) as HTMLButtonElement).disabled
  ).toBe(true);
});
