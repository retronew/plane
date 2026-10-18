import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DeleteIssueModal } from "./delete-issue-modal";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), authorized: true }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issueMap: {} }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ id: "project", identifier: "TEST" }) }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user" } }),
  useUserPermissions: () => ({ allowPermissions: () => mocks.authorized }),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Translation: () => <span>Confirmation</span>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/dialog", () => ({
  ConfirmDialog: ({
    isOpen,
    isSubmitting,
    handleSubmit,
    handleClose,
  }: {
    isOpen: boolean;
    isSubmitting: boolean;
    handleSubmit: () => Promise<void>;
    handleClose: () => void;
  }) => (
    <section data-testid="dialog" data-open={isOpen} data-busy={isSubmitting}>
      <button onClick={() => void handleSubmit()}>Delete</button>
      <button onClick={handleClose}>Close</button>
    </section>
  ),
}));

type Props = ComponentProps<typeof DeleteIssueModal>;
const data = { id: "issue", project_id: "project", created_by: "creator", sequence_id: 1 } as Props["data"];
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
});

it("does not become busy without onSubmit and preserves the mounted closed dialog", () => {
  const props = { isOpen: true, data, handleClose: vi.fn() };
  const view = render(<DeleteIssueModal {...props} />);
  const dialog = screen.getByTestId("dialog");
  fireEvent.click(screen.getByText("Delete"));
  expect(dialog.getAttribute("data-busy")).toBe("false");
  view.rerender(<DeleteIssueModal {...props} isOpen={false} />);
  expect(screen.getByTestId("dialog")).toBe(dialog);
  expect(dialog.getAttribute("data-open")).toBe("false");
});

it("locks duplicate submits synchronously and closes exactly once on success", async () => {
  const request = deferred();
  const onSubmit = vi.fn(() => request.promise);
  const handleClose = vi.fn();
  render(<DeleteIssueModal isOpen data={data} onSubmit={onSubmit} handleClose={handleClose} />);
  act(() => {
    screen.getByText("Delete").click();
    screen.getByText("Delete").click();
  });
  expect(onSubmit).toHaveBeenCalledOnce();
  await act(async () => request.resolve());
  expect(handleClose).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
});

it.each(["reopen", "entity", "project", "kind", "unmount"])("ignores an old response after %s", async (change) => {
  const request = deferred();
  const props = { isOpen: true, data, onSubmit: vi.fn(() => request.promise), handleClose: vi.fn() };
  const view = render(<DeleteIssueModal {...props} />);
  fireEvent.click(screen.getByText("Delete"));
  if (change === "reopen") {
    view.rerender(<DeleteIssueModal {...props} isOpen={false} />);
    view.rerender(<DeleteIssueModal {...props} />);
  } else if (change === "unmount") view.unmount();
  else
    view.rerender(
      <DeleteIssueModal
        {...props}
        data={
          {
            ...data,
            id: change === "entity" ? "other" : "issue",
            project_id: change === "project" ? "other" : "project",
          } as Props["data"]
        }
        isEpic={change === "kind"}
      />
    );
  await act(async () => request.resolve());
  expect(props.handleClose).not.toHaveBeenCalled();
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("old rejection cannot clear a newer pending submit", async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const props = { isOpen: true, data, onSubmit: vi.fn(() => oldRequest.promise), handleClose: vi.fn() };
  const view = render(<DeleteIssueModal {...props} />);
  fireEvent.click(screen.getByText("Delete"));
  view.rerender(<DeleteIssueModal {...props} isOpen={false} />);
  view.rerender(<DeleteIssueModal {...props} onSubmit={() => newRequest.promise} />);
  fireEvent.click(screen.getByText("Delete"));
  await act(async () => oldRequest.reject(new Error("old")));
  expect(screen.getByTestId("dialog").getAttribute("data-busy")).toBe("true");
  expect(props.handleClose).not.toHaveBeenCalled();
  await act(async () => newRequest.resolve());
  expect(props.handleClose).toHaveBeenCalledOnce();
});

it.each([new Error("failure"), { error: "Only admin or creator can delete the work item" }])(
  "reports errors and retains the error-close contract",
  async (error) => {
    const handleClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(error);
    render(<DeleteIssueModal isOpen data={data} onSubmit={onSubmit} handleClose={handleClose} />);
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(handleClose).toHaveBeenCalledOnce());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  }
);

it("reports unauthorized attempts and closes even without a submit callback", () => {
  mocks.authorized = false;
  const handleClose = vi.fn();
  render(<DeleteIssueModal isOpen data={data} handleClose={handleClose} />);
  fireEvent.click(screen.getByText("Delete"));
  expect(handleClose).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
});
