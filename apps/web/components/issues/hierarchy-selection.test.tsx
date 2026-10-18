import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ParentIssuesListModal } from "./parent-issues-list-modal";
import { ExistingIssuesListModal } from "../core/modals/existing-issues-list-modal";

const state = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }), Translation: () => null }));
vi.mock("@/services/project", () => ({
  ProjectService: class {
    projectIssuesSearch = state.search;
  },
}));
vi.mock("@/hooks/use-debounce", () => ({ default: (value: string) => value }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/issues/issue-detail/issue-identifier", () => ({ IssueIdentifier: () => null }));
vi.mock("@/components/core/modals/issue-search-modal-empty-state", () => ({
  IssueSearchModalEmptyState: () => <p>empty</p>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/blocks/skeleton", () => ({
  Loader: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Item: () => <span>loading</span>,
  }),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Part,
    DialogContent: Part,
    DialogActions: Part,
    DialogInfo: Part,
    DialogMain: Part,
    DialogTitle: Part,
  };
});
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/combobox", () => {
  let select: (value: unknown) => void;
  let multiple = false;
  let items: unknown[] = [];
  let input: (value: string, details: { reason: string }) => void;
  return {
    Combobox: ({
      children,
      onValueChange,
      onInputValueChange,
      multiple: isMultiple,
      value,
      items: values,
    }: {
      children: ReactNode;
      onValueChange: typeof select;
      onInputValueChange: typeof input;
      multiple?: boolean;
      value: unknown[];
      items?: unknown[];
    }) => {
      select = onValueChange;
      multiple = !!isMultiple;
      items = values ?? [];
      input = onInputValueChange;
      void value;
      return <div>{children}</div>;
    },
    ComboboxSearch: () => (
      <input aria-label="search" onChange={(e) => input(e.target.value, { reason: "input-change" })} />
    ),
    ComboboxList: ({ children }: { children: ReactNode | ((item: unknown, index: number) => ReactNode) }) => (
      <div>{typeof children === "function" ? items.map(children) : children}</div>
    ),
    ComboboxItem: ({ label, value }: { label: string; value: unknown }) => (
      <button onClick={() => select(multiple ? [value] : value)}>{label}</button>
    ),
  };
});
const issue = { id: "parent", name: "Candidate", project_id: "p", type_id: "story" };
beforeEach(() => {
  state.search.mockReset();
  state.search.mockResolvedValue([issue]);
});

it("sends the final untyped context and retains the parent modal after a hierarchy rejection", async () => {
  const close = vi.fn();
  const change = vi.fn().mockRejectedValue({ hierarchy: ["HIERARCHY_INVALID_LEVEL"] });
  render(<ParentIssuesListModal isOpen handleClose={close} onChange={change} projectId="p" typeId={null} />);
  fireEvent.click(await screen.findByText("Candidate"));
  await screen.findByText("web.issue_hierarchy.invalid_level");
  expect(close).not.toHaveBeenCalled();
  expect(state.search).toHaveBeenCalledWith("w", "p", expect.objectContaining({ type_id: "null", parent: true }));
  change.mockResolvedValue(undefined);
  fireEvent.click(screen.getByText("Candidate"));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

it("retries search and ignores an old response after the final type changes", async () => {
  let resolveOld!: (value: unknown[]) => void;
  state.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  const props = { isOpen: true, handleClose: vi.fn(), onChange: vi.fn(), projectId: "p" };
  const view = render(<ParentIssuesListModal {...props} typeId="old" />);
  state.search.mockRejectedValueOnce(new Error("offline"));
  view.rerender(<ParentIssuesListModal {...props} typeId="new" />);
  await screen.findByText("web.issue_hierarchy.search_failed");
  resolveOld([{ ...issue, name: "Stale" }]);
  fireEvent.click(screen.getByText("web.retry"));
  await screen.findByText("Candidate");
  expect(screen.queryByText("Stale")).toBeNull();
  expect(state.search).toHaveBeenLastCalledWith("w", "p", expect.objectContaining({ type_id: "new" }));
});

it("retains selected sub-items and permits retry after save failure", async () => {
  const close = vi.fn();
  const submit = vi.fn().mockRejectedValue({ hierarchy: ["HIERARCHY_CYCLE"] });
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={close}
      handleOnSubmit={submit}
      searchParams={{ sub_issue: true, issue_id: "epic", type_id: "epic-type" }}
    />
  );
  fireEvent.click(await screen.findByText("Candidate"));
  fireEvent.click(screen.getByText("issue.select.add_selected"));
  await screen.findByText("web.issue_hierarchy.cycle");
  expect(close).not.toHaveBeenCalled();
  submit.mockResolvedValue(undefined);
  fireEvent.click(screen.getByText("issue.select.add_selected"));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(submit).toHaveBeenLastCalledWith([issue]);
});

it("requeries sub-item candidates when the unsaved parent type changes and retries failures", async () => {
  state.search.mockRejectedValueOnce(new Error("offline"));
  const props = { workspaceSlug: "w", projectId: "p", isOpen: true, handleClose: vi.fn(), handleOnSubmit: vi.fn() };
  const view = render(
    <ExistingIssuesListModal {...props} searchParams={{ sub_issue: true, issue_id: "i", type_id: "old" }} />
  );
  await screen.findByText("web.issue_hierarchy.search_failed");
  fireEvent.click(screen.getByText("web.retry"));
  await screen.findByText("Candidate");
  view.rerender(
    <ExistingIssuesListModal {...props} searchParams={{ sub_issue: true, issue_id: "i", type_id: "null" }} />
  );
  await waitFor(() =>
    expect(state.search).toHaveBeenLastCalledWith(
      "w",
      "p",
      expect.objectContaining({ type_id: "null", sub_issue: true })
    )
  );
});
