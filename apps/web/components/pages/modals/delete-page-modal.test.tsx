import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { DeletePageModal } from "./delete-page-modal";

const mocks = vi.hoisted(() => ({
  removePage: vi.fn(),
  replace: vi.fn(),
  close: vi.fn(),
  toast: vi.fn(),
  params: { workspaceSlug: "workspace", projectId: "project", pageId: "page" as string | undefined },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/store", () => ({ usePageStore: () => ({ removePage: mocks.removePage }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/dialog", () => ({
  ConfirmDialog: ({ isOpen, handleSubmit }: { isOpen: boolean; handleSubmit: () => Promise<void> }) =>
    isOpen ? <button onClick={() => void handleSubmit()}>Confirm delete</button> : null,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.params.pageId = "page";
});

function renderModal() {
  render(
    <DeletePageModal
      isOpen
      onClose={mocks.close}
      page={{ id: "page", name: "Draft" } as React.ComponentProps<typeof DeletePageModal>["page"]}
      storeType={"PROJECT" as React.ComponentProps<typeof DeletePageModal>["storeType"]}
    />
  );
}

it("returns to the page list after deleting the current page", async () => {
  mocks.removePage.mockResolvedValue(undefined);
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/workspace/projects/project/pages/"));
  expect(mocks.removePage).toHaveBeenCalledWith({ pageId: "page" });
});

it("stays on the list when deleting from the list", async () => {
  mocks.params.pageId = undefined;
  mocks.removePage.mockResolvedValue(undefined);
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("keeps the page open and reports deletion failures", async () => {
  mocks.removePage.mockRejectedValue(new Error("Forbidden"));
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
});
