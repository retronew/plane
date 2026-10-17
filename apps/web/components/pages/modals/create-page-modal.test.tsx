import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EPageAccess } from "@plane/constants";
import { CreatePageModal } from "./create-page-modal";

const mocks = vi.hoisted(() => ({ createPage: vi.fn(), close: vi.fn(), push: vi.fn() }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/store", () => ({ usePageStore: () => ({ createPage: mocks.createPage }) }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./page-form", () => ({
  PageForm: ({
    formData,
    handleFormData,
    handleFormSubmit,
  }: {
    formData: { name?: string; access?: number };
    handleFormData: (key: string, value: string) => void;
    handleFormSubmit: () => Promise<void>;
  }) => (
    <>
      <input
        aria-label="Title"
        value={formData.name ?? ""}
        onChange={(event) => handleFormData("name", event.target.value)}
      />
      <output data-testid="access">{formData.access}</output>
      <button onClick={() => void handleFormSubmit()}>Submit</button>
    </>
  ),
}));
beforeEach(() => vi.resetAllMocks());

it("redirects after creation without inserting the new page into the list", async () => {
  let complete!: (page: { id: string }) => void;
  mocks.createPage.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  render(
    <CreatePageModal
      workspaceSlug="workspace"
      projectId="project"
      isModalOpen
      handleModalClose={mocks.close}
      redirectionEnabled
      storeType={"PROJECT" as React.ComponentProps<typeof CreatePageModal>["storeType"]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(mocks.createPage).toHaveBeenCalledWith(expect.any(Object), { addToStore: false });
  expect(mocks.push).not.toHaveBeenCalled();
  complete({ id: "new-page" });
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/project/pages/new-page"));
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("does not navigate if creation returns no page", async () => {
  mocks.createPage.mockResolvedValue(undefined);
  render(
    <CreatePageModal
      workspaceSlug="workspace"
      projectId="project"
      isModalOpen
      handleModalClose={mocks.close}
      redirectionEnabled
      storeType={"PROJECT" as React.ComponentProps<typeof CreatePageModal>["storeType"]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(mocks.createPage).toHaveBeenCalledOnce());
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
});

it("initializes and updates access without losing the current page draft", () => {
  const props = {
    workspaceSlug: "workspace",
    projectId: "project",
    isModalOpen: true,
    pageAccess: EPageAccess.PUBLIC,
    handleModalClose: mocks.close,
    storeType: "PROJECT" as React.ComponentProps<typeof CreatePageModal>["storeType"],
  };
  const view = render(<CreatePageModal {...props} />);
  expect(screen.getByTestId("access").textContent).toBe(String(EPageAccess.PUBLIC));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Keep my draft" } });
  view.rerender(<CreatePageModal {...props} pageAccess={EPageAccess.PRIVATE} />);
  expect(screen.getByTestId("access").textContent).toBe(String(EPageAccess.PRIVATE));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Keep my draft");
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(mocks.createPage).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Keep my draft", access: EPageAccess.PRIVATE }),
    { addToStore: true }
  );
});
