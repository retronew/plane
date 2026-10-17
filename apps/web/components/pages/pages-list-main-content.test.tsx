import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EPageAccess } from "@plane/constants";
import { EPageStoreType } from "@/hooks/store";
import { PagesListMainContent } from "./pages-list-main-content";

const mocks = vi.hoisted(() => ({ createPage: vi.fn(), push: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", projectId: "url-project" }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT" },
  usePageStore: () => ({
    createPage: mocks.createPage,
    isAnyPageAvailable: false,
    getCurrentProjectPageIdsByTab: () => [],
    getCurrentProjectFilteredPageIdsByTab: () => [],
    loader: undefined,
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/pages/loaders/page-loader", () => ({ PageLoader: () => null }));

beforeEach(() => vi.resetAllMocks());

function renderEmptyList(pageType: "public" | "private" = "public") {
  render(
    <PagesListMainContent pageType={pageType} storeType={EPageStoreType.PROJECT}>
      <p>Page list</p>
    </PagesListMainContent>
  );
  return screen.getByRole("button", { name: "project_empty_state.pages.cta_primary" });
}

it.each([
  ["public", EPageAccess.PUBLIC],
  ["private", EPageAccess.PRIVATE],
] as const)("navigates immediately after creating a %s page from the empty state", async (pageType, access) => {
  let complete!: (page: { id: string }) => void;
  mocks.createPage.mockReturnValue(new Promise((resolve) => (complete = resolve)));
  const createButton = renderEmptyList(pageType);
  fireEvent.click(createButton);
  expect(mocks.createPage).toHaveBeenCalledExactlyOnceWith({ access }, { addToStore: false });
  expect(mocks.push).not.toHaveBeenCalled();
  expect((createButton as HTMLButtonElement).disabled).toBe(true);

  await act(async () => complete({ id: "new-page" }));

  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/workspace/projects/url-project/pages/new-page");
  expect((createButton as HTMLButtonElement).disabled).toBe(false);
});

it("does not navigate when creation returns undefined", async () => {
  mocks.createPage.mockResolvedValue(undefined);
  const createButton = renderEmptyList();
  fireEvent.click(createButton);
  await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
  expect(mocks.createPage).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("does not navigate and reports rejected creation", async () => {
  mocks.createPage.mockRejectedValue(new Error("offline"));
  const createButton = renderEmptyList();
  fireEvent.click(createButton);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.push).not.toHaveBeenCalled();
  await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
});
