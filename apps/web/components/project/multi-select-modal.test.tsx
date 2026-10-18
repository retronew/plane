import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectMultiSelectModal } from "./multi-select-modal";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), close: vi.fn(), toast: vi.fn() }));
const projects = [
  { id: "project-1", identifier: "ONE", name: "First project", logo_props: {} },
  { id: "project-2", identifier: "TWO", name: "Second project", logo_props: {} },
];
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ ProjectLogo: () => null }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: (id: string) => projects.find((project) => project.id === id) }),
}));

function renderModal() {
  render(
    <ProjectMultiSelectModal
      isOpen
      onClose={mocks.close}
      selectedProjectIds={["project-1"]}
      projectIds={projects.map((project) => project.id)}
      onSubmit={mocks.submit}
    />
  );
  // Removing a selected chip exercises the component's actual selection handler.
  fireEvent.click(screen.getByRole("button", { name: "ONE" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.submit.mockResolvedValue(undefined);
});

it("submits changed project IDs and closes only after success", async () => {
  let resolve!: () => void;
  mocks.submit.mockReturnValueOnce(new Promise<void>((done) => (resolve = done)));
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  expect(mocks.submit).toHaveBeenCalledWith([]);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "confirming" }).getAttribute("aria-disabled")).toBe("true");
  await act(async () => resolve());
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("keeps the dialog and selection after rejection, releases loading, and allows retry", async () => {
  mocks.submit.mockRejectedValueOnce(new Error("request failed"));
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "something_went_wrong_please_try_again" })
  );
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "ONE" })).toBeNull();
  const confirm = screen.getByRole("button", { name: "confirm" });
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(confirm);
  await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
  expect(mocks.submit.mock.calls).toEqual([[[]], [[]]]);
});

it("prevents duplicate requests while submission is pending", async () => {
  let resolve!: () => void;
  mocks.submit.mockReturnValueOnce(new Promise<void>((done) => (resolve = done)));
  renderModal();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  fireEvent.click(screen.getByRole("button", { name: "confirming" }));
  expect(mocks.submit).toHaveBeenCalledOnce();
  await act(async () => resolve());
  expect(mocks.close).toHaveBeenCalledOnce();
});
