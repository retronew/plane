import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { EPageStoreType } from "@/hooks/store";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageListBlock } from "./block";

const mocks = vi.hoisted(() => ({
  page: {} as TPageInstance,
  push: vi.fn(),
  toggleFavorite: vi.fn(),
  copyLink: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...props }: React.ComponentProps<"a">) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace" }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/hooks/store", () => ({ usePage: () => mocks.page }));
vi.mock("@/components/dropdowns/label/label-select", () => ({
  LabelSelect: () => <button aria-label="Page labels">Labels</button>,
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ display_name: "Page owner", avatar_url: "" }) }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/use-page-flag", () => ({ usePageFlag: () => ({ isMovePageEnabled: false }) }));
vi.mock("@/hooks/use-page-operations", () => ({
  usePageOperations: () => ({ pageOperations: { toggleFavorite: mocks.toggleFavorite, copyLink: mocks.copyLink } }),
}));
vi.mock("@/components/pages/modals/move-page-modal", () => ({ MovePageModal: () => null }));
vi.mock("@/components/pages/modals/delete-page-modal", () => ({ DeletePageModal: () => null }));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.page = {
    id: "page",
    project_ids: ["project"],
    name: "Project notes",
    access: 0,
    owned_by: "owner",
    is_favorite: true,
    canCurrentUserFavoritePage: true,
    canCurrentUserArchivePage: true,
    canCurrentUserDeletePage: true,
    getRedirectionLink: () => "/workspace/projects/project/pages/page",
  } as TPageInstance;
});

function fixture() {
  return <PageListBlock pageId="page" storeType={"PROJECT" as EPageStoreType} />;
}

it("keeps title navigation separate from favorite and menu actions", async () => {
  render(fixture());
  const link = screen.getByRole("link", { name: "Project notes" });
  expect(link.getAttribute("href")).toBe("/workspace/projects/project/pages/page");
  fireEvent.click(screen.getByRole("button", { name: "Page labels" }));
  expect(mocks.push).not.toHaveBeenCalled();
  const favorite = screen.getByRole("button", { name: "add_to_favorites" });
  expect(favorite.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(favorite);
  expect(mocks.toggleFavorite).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  await screen.findByRole("menu");
  const archive = screen.getByRole("menuitem", { name: "web.archive" });
  const deleteItem = screen.getByRole("menuitem", { name: "web.delete" });
  expect(archive.previousElementSibling?.getAttribute("role")).toBe("separator");
  expect(archive.nextElementSibling).toBe(deleteItem);
  expect(deleteItem.className).toContain("text-danger");
  fireEvent.click(screen.getByRole("menuitem", { name: "web.copy_link" }));
  expect(mocks.copyLink).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();

  const owner = screen.getByRole("link", { name: "web.runtime.owned_by" });
  expect(owner.getAttribute("href")).toBe("/workspace/profile/owner/");
  fireEvent.click(owner);
  expect(mocks.push).not.toHaveBeenCalled();

  fireEvent.click(link);
  expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/project/pages/page");
});

it("navigates from row padding and gaps while keeping real anchors separate", () => {
  const { container } = render(fixture());
  const row = screen.getByRole("link", { name: "Project notes" }).closest(".group")!;
  fireEvent.click(row);
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/workspace/projects/project/pages/page");
  mocks.push.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Page labels" }).parentElement!.parentElement!);
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/workspace/projects/project/pages/page");
  expect(container.querySelector("a a")).toBeNull();
});

it("allows text selection and does not hijack modified blank-area clicks", () => {
  render(fixture());
  const row = screen.getByRole("link", { name: "Project notes" }).closest(".group")!;
  fireEvent.click(row, { metaKey: true });
  fireEvent.click(row, { ctrlKey: true });
  expect(mocks.push).not.toHaveBeenCalled();
  const selection = vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Project notes" } as Selection);
  fireEvent.click(row);
  expect(mocks.push).not.toHaveBeenCalled();
  selection.mockRestore();
});

it("does not link a missing page owner", () => {
  mocks.page.owned_by = undefined;
  render(fixture());
  expect(screen.queryByRole("link", { name: "web.runtime.owned_by" })).toBeNull();
});

it("retains permission checks when actions are hidden", async () => {
  mocks.page.canCurrentUserFavoritePage = false;
  mocks.page.canCurrentUserArchivePage = false;
  mocks.page.canCurrentUserDeletePage = false;
  render(fixture());
  expect(screen.queryByRole("button", { name: "add_to_favorites" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  await screen.findByRole("menu");
  expect(screen.queryByRole("menuitem", { name: "web.archive" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "web.delete" })).toBeNull();
  expect(screen.getByRole("menuitem", { name: "web.copy_link" })).toBeTruthy();
});
