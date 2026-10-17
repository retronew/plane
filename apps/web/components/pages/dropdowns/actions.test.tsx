import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EPageAccess } from "@plane/constants";
import type { TPageInstance } from "@/store/pages/base-page";
import type { EPageStoreType } from "@/hooks/store";
import { PageActions } from "./actions";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-page-flag", () => ({ usePageFlag: () => ({ isMovePageEnabled: false }) }));
vi.mock("@/hooks/use-page-operations", () => ({ usePageOperations: () => ({ pageOperations: {} }) }));
vi.mock("@/components/pages/modals/move-page-modal", () => ({ MovePageModal: () => null }));
vi.mock("@/components/pages/modals/delete-page-modal", () => ({
  DeletePageModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open aria-label="Delete page" /> : null),
}));

beforeEach(() => vi.clearAllMocks());

it("groups archive and danger-styled delete at the bottom", async () => {
  const page = {
    id: "page",
    access: EPageAccess.PUBLIC,
    archived_at: null,
    canCurrentUserArchivePage: true,
    canCurrentUserDeletePage: true,
  } as TPageInstance;
  render(
    <PageActions
      page={page}
      optionsOrder={["copy-link", "archive-restore", "delete"]}
      storeType={"PROJECT" as EPageStoreType}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  await screen.findByRole("menu");
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
    "web.copy_link",
    "web.archive",
    "web.delete",
  ]);
  const archive = screen.getByRole("menuitem", { name: "web.archive" });
  expect(archive.previousElementSibling?.getAttribute("role")).toBe("separator");
  expect(archive.nextElementSibling).toBe(screen.getByRole("menuitem", { name: "web.delete" }));
  expect(screen.getByRole("menuitem", { name: "web.delete" }).className).toContain("text-danger");
});

it.each([true, false])("shows Delete for an active page only when permitted (%s)", async (canCurrentUserDeletePage) => {
  const page = {
    id: "page",
    access: EPageAccess.PUBLIC,
    archived_at: null,
    canCurrentUserDeletePage,
  } as TPageInstance;
  render(<PageActions page={page} optionsOrder={["copy-link", "delete"]} storeType={"PROJECT" as EPageStoreType} />);
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  await screen.findByRole("menu");
  expect(screen.getByRole("menuitem", { name: "web.copy_link" })).toBeTruthy();

  if (canCurrentUserDeletePage) {
    expect(screen.getByRole("menuitem", { name: "web.delete" }).className).toContain("text-danger");
    fireEvent.click(screen.getByRole("menuitem", { name: "web.delete" }));
    expect(screen.getByRole("dialog", { name: "Delete page" })).toBeTruthy();
  } else {
    expect(screen.queryByRole("menuitem", { name: "web.delete" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Delete page" })).toBeNull();
  }
});
