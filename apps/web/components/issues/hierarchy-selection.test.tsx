import type { ComponentType, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ParentIssuesListModal } from "./parent-issues-list-modal";
import { ExistingIssuesListModal } from "../core/modals/existing-issues-list-modal";

const state = vi.hoisted(() => ({ search: vi.fn(), realCombobox: false }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }), Translation: () => null }));
vi.mock("@/services/project", () => ({
  ProjectService: class {
    projectIssuesSearch = state.search;
  },
}));
vi.mock("@/components/core/modals/existing-issues-filters", () => ({
  emptyExistingIssueFilters: () => ({ state_group: [], priority: [], start_date: [], target_date: [] }),
  ExistingIssuesFilters: ({
    onChange,
    children,
  }: {
    children?: ReactNode;
    onChange: (value: {
      state_group: string[];
      priority: string[];
      start_date: string[];
      target_date: string[];
    }) => void;
  }) => (
    <>
      {children}
      <button
        onClick={() =>
          onChange({
            state_group: ["backlog"],
            priority: ["high"],
            start_date: ["2026-11-01;after", "2026-11-10;before"],
            target_date: ["1_weeks;after;fromnow"],
          })
        }
      >
        Filter candidates
      </button>
      <button onClick={() => onChange({ state_group: [], priority: [], start_date: [], target_date: [] })}>
        Clear filters
      </button>
    </>
  ),
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
    Dialog: ({
      children,
      disablePointerDismissal,
      onOpenChange,
      onOpenChangeComplete,
      open,
    }: {
      children: ReactNode;
      open?: boolean;
      disablePointerDismissal?: boolean;
      onOpenChange?: (open: boolean) => void;
      onOpenChangeComplete?: (open: boolean) => void;
    }) => (
      <div>
        <button
          onClick={() => {
            if (!disablePointerDismissal) onOpenChange?.(false);
          }}
        >
          Dialog outside press
        </button>
        <button onClick={() => onOpenChange?.(false)}>Dialog Escape</button>
        <button onClick={() => onOpenChangeComplete?.(!!open)}>Dialog animation complete</button>
        {children}
      </div>
    ),
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
vi.mock("@makeplane/propel/components/combobox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makeplane/propel/components/combobox")>();
  let select: (value: unknown) => void;
  let multiple = false;
  let items: unknown[] = [];
  let input: (value: string, details: { reason: string }) => void;
  const mocks = {
    Combobox: ({
      children,
      onValueChange,
      onInputValueChange,
      onOpenChange,
      inputValue,
      multiple: isMultiple,
      value,
      items: values,
    }: {
      children: ReactNode;
      onValueChange: typeof select;
      onInputValueChange: typeof input;
      onOpenChange?: (open: boolean, details: { reason: string }) => void;
      inputValue?: string;
      multiple?: boolean;
      value: unknown[];
      items?: unknown[];
    }) => {
      select = onValueChange;
      multiple = !!isMultiple;
      items = values ?? [];
      input = onInputValueChange;
      void value;
      return (
        <div>
          <button onClick={() => onOpenChange?.(false, { reason: "outside-press" })}>Combobox outside press</button>
          <button onClick={() => onOpenChange?.(false, { reason: "focus-out" })}>Combobox focus out</button>
          <button onClick={() => input(inputValue ?? "", { reason: "input-change" })}>Same input</button>
          <button onClick={() => input("", { reason: "input-clear" })}>Clear on pick</button>
          {children}
        </div>
      );
    },
    ComboboxSearch: () => (
      <input aria-label="search" onChange={(e) => input(e.target.value, { reason: "input-change" })} />
    ),
    ComboboxList: ({ children }: { children: ReactNode | ((item: unknown, index: number) => ReactNode) }) => (
      <div>{typeof children === "function" ? items.map(children) : children}</div>
    ),
    ComboboxItem: ({ label, value, disabled }: { label: string; value: unknown; disabled?: boolean }) => (
      <button disabled={disabled} onClick={() => select(multiple ? [value] : value)}>
        {label}
      </button>
    ),
  };
  return Object.fromEntries(
    Object.entries(mocks).map(([name, Mock]) => [
      name,
      (props: Record<string, unknown>) => {
        const Component = (state.realCombobox ? actual[name as keyof typeof mocks] : Mock) as ComponentType<
          Record<string, unknown>
        >;
        return <Component {...props} />;
      },
    ])
  );
});
const issue = { id: "parent", name: "Candidate", project_id: "p", type_id: "story" };
beforeEach(() => {
  state.realCombobox = false;
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

it("filters cycle candidates on the server and preserves selected items outside the new results", async () => {
  const another = { ...issue, id: "second", name: "Filtered candidate" };
  state.search.mockImplementation(async (_workspace, _project, params) => (params.priority ? [another] : [issue]));
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={vi.fn()}
      handleOnSubmit={submit}
      searchParams={{ cycle: true }}
    />
  );
  fireEvent.click(await screen.findByText("Candidate"));
  fireEvent.click(screen.getByText("Filter candidates"));
  await screen.findByText("Filtered candidate");
  expect(state.search).toHaveBeenLastCalledWith(
    "w",
    "p",
    expect.objectContaining({
      cycle: true,
      state_group: "backlog",
      priority: "high",
      start_date: "2026-11-01;after,2026-11-10;before",
      target_date: "1_weeks;after;fromnow",
    })
  );
  fireEvent.click(screen.getByText("issue.select.select_all"));
  fireEvent.click(screen.getByText("Clear filters"));
  await waitFor(() =>
    expect(state.search).toHaveBeenLastCalledWith("w", "p", { search: "", workspace_search: false, cycle: true })
  );
  fireEvent.click(screen.getByText("issue.select.add_selected"));
  await waitFor(() => expect(submit).toHaveBeenCalledWith([issue, another]));
});

it("keeps cycle date filters out of other modal usages and resets them on close", async () => {
  const props = { workspaceSlug: "w", projectId: "p", isOpen: true, handleClose: vi.fn(), handleOnSubmit: vi.fn() };
  const view = render(<ExistingIssuesListModal {...props} searchParams={{ cycle: true }} />);
  await screen.findByText("Candidate");
  fireEvent.click(screen.getByText("Filter candidates"));
  await waitFor(() =>
    expect(state.search).toHaveBeenLastCalledWith("w", "p", expect.objectContaining({ start_date: expect.any(String) }))
  );
  view.rerender(<ExistingIssuesListModal {...props} searchParams={{ module: "m", target_date: "none" }} />);
  await waitFor(() =>
    expect(state.search).toHaveBeenLastCalledWith("w", "p", {
      search: "",
      workspace_search: false,
      module: "m",
      target_date: "none",
    })
  );
  expect(screen.queryByText("Filter candidates")).toBeNull();
  fireEvent.click(screen.getByText("common.cancel"));
  view.rerender(<ExistingIssuesListModal {...props} isOpen={false} searchParams={{ cycle: true }} />);
  fireEvent.click(screen.getByText("Dialog animation complete"));
  view.rerender(<ExistingIssuesListModal {...props} searchParams={{ cycle: true }} />);
  await waitFor(() =>
    expect(state.search).toHaveBeenLastCalledWith("w", "p", { search: "", workspace_search: false, cycle: true })
  );
});

it("keeps the dialog and selection on outside press and input blur, but allows explicit Escape", async () => {
  const close = vi.fn();
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={close}
      handleOnSubmit={vi.fn()}
      searchParams={{ cycle: true }}
    />
  );
  fireEvent.click(await screen.findByText("Candidate"));
  fireEvent.click(screen.getByText("Dialog outside press"));
  fireEvent.click(screen.getByText("Combobox outside press"));
  fireEvent.click(screen.getByText("Combobox focus out"));
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByText("issue.select.empty")).toBeNull();
  fireEvent.click(screen.getByText("Dialog Escape"));
  expect(close).toHaveBeenCalledOnce();
  expect((screen.getByText("issue.select.add_selected") as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText("Candidate")).toBeTruthy();
  expect(screen.queryByText("loading")).toBeNull();
});

it.each(["cancel", "Escape", "submit", "external"])(
  "preserves actual inline rows through %s exit and resets only after animation completes",
  async (method) => {
    state.realCombobox = true;
    const submit = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    const props = {
      workspaceSlug: "w",
      projectId: "p",
      isOpen: true,
      handleClose: close,
      handleOnSubmit: submit,
      searchParams: { cycle: true },
      workspaceLevelToggle: true,
    };
    const view = render(<ExistingIssuesListModal {...props} />);
    const row = (await screen.findByText("Candidate")).closest('[role="option"]')!;
    fireEvent.click(screen.getByText("Candidate"));
    fireEvent.click(screen.getByText("Filter candidates"));
    await waitFor(() => expect(row.getAttribute("aria-disabled")).not.toBe("true"));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "needle" } });
    await waitFor(() =>
      expect(state.search).toHaveBeenLastCalledWith("w", "p", expect.objectContaining({ search: "needle" }))
    );
    await waitFor(() => expect(row.getAttribute("aria-disabled")).not.toBe("true"));
    if (method === "cancel") fireEvent.click(screen.getByText("common.cancel"));
    if (method === "Escape") fireEvent.click(screen.getByText("Dialog Escape"));
    if (method === "submit") {
      fireEvent.click(screen.getByText("issue.select.add_selected"));
      await waitFor(() => expect(close).toHaveBeenCalledOnce());
      expect(submit).toHaveBeenCalledWith([issue]);
    }
    view.rerender(<ExistingIssuesListModal {...props} isOpen={false} />);
    expect(screen.getByText("Candidate").closest('[role="option"]')).toBe(row);
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("needle");
    expect(screen.queryByText("loading")).toBeNull();
    expect(screen.queryByText("empty")).toBeNull();
    fireEvent.click(screen.getByText("Dialog animation complete"));
    expect(screen.queryByText("Candidate")).toBeNull();
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("");
    expect((screen.getByText("issue.select.add_selected") as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<ExistingIssuesListModal {...props} />);
    await screen.findByText("Candidate");
    expect(state.search).toHaveBeenLastCalledWith("w", "p", { search: "", workspace_search: false, cycle: true });
    expect((screen.getByText("issue.select.add_selected") as HTMLButtonElement).disabled).toBe(true);
  }
);

it.each(["cancel", "external"])(
  "invalidates pending search on %s close without replacing exit content",
  async (method) => {
    const props = {
      workspaceSlug: "w",
      projectId: "p",
      isOpen: true,
      handleClose: vi.fn(),
      handleOnSubmit: vi.fn(),
      searchParams: { cycle: true },
    };
    const view = render(<ExistingIssuesListModal {...props} />);
    const row = await screen.findByText("Candidate");
    let resolvePending!: (value: unknown[]) => void;
    state.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        })
    );
    fireEvent.click(screen.getByText("Filter candidates"));
    if (method === "cancel") fireEvent.click(screen.getByText("common.cancel"));
    // Explicit close must invalidate even before the parent propagates isOpen=false.
    if (method === "external") view.rerender(<ExistingIssuesListModal {...props} isOpen={false} />);
    await act(async () => resolvePending([{ ...issue, name: "Late result" }]));
    expect(screen.queryByText("Late result")).toBeNull();
    expect(screen.getByText("Candidate")).toBe(row);
    expect(screen.queryByText("loading")).toBeNull();
    view.rerender(<ExistingIssuesListModal {...props} isOpen={false} />);
    fireEvent.click(screen.getByText("Dialog animation complete"));
    expect(screen.queryByText("Candidate")).toBeNull();
    expect(screen.queryByText("loading")).toBeNull();
  }
);

it("ignores unchanged input and clear-on-pick events without removing results", async () => {
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={vi.fn()}
      handleOnSubmit={vi.fn()}
      searchParams={{ cycle: true }}
    />
  );
  await screen.findByText("Candidate");
  fireEvent.click(screen.getByText("Same input"));
  fireEvent.click(screen.getByText("Clear on pick"));
  expect(screen.getByText("Candidate")).toBeTruthy();
  expect(screen.queryByText("loading")).toBeNull();
  expect(state.search).toHaveBeenCalledOnce();
});

it("keeps rows mounted during filter refresh, disables stale picks and ignores an older response", async () => {
  let resolveOld!: (value: unknown[]) => void;
  let resolveNew!: (value: unknown[]) => void;
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={vi.fn()}
      handleOnSubmit={vi.fn()}
      searchParams={{ cycle: true }}
    />
  );
  const row = await screen.findByText("Candidate");
  state.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  fireEvent.click(screen.getByText("Filter candidates"));
  expect(screen.getByText("Candidate")).toBe(row);
  expect(row.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("loading")).toBeNull();
  fireEvent.click(row);
  expect((screen.getByText("issue.select.add_selected") as HTMLButtonElement).disabled).toBe(true);
  state.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNew = resolve;
      })
  );
  fireEvent.click(screen.getByText("Clear filters"));
  await act(async () => resolveOld([{ ...issue, name: "Stale filtered result" }]));
  expect(screen.queryByText("Stale filtered result")).toBeNull();
  expect(screen.getByText("Candidate")).toBe(row);
  await act(async () => resolveNew([{ ...issue, name: "Fresh result" }]));
  const fresh = screen.getByText("Fresh result");
  expect(fresh.hasAttribute("disabled")).toBe(false);
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

it("toggles actual row text, identifier, checkbox and blank space while links preserve selection", async () => {
  state.realCombobox = true;
  state.search.mockResolvedValue([{ ...issue, project__identifier: "PRJ", sequence_id: 42 }]);
  render(
    <ExistingIssuesListModal
      workspaceSlug="w"
      projectId="p"
      isOpen
      handleClose={vi.fn()}
      handleOnSubmit={vi.fn()}
      searchParams={{ cycle: true }}
    />
  );
  const title = await screen.findByText("Candidate");
  const row = title.closest('[role="option"]')!;
  const identifier = screen.getByText("PRJ-42");
  const checkbox = row.querySelector('[data-slot="combobox-checkbox-item-indicator"]') ?? row.firstElementChild!;
  for (const target of [title, identifier, row, checkbox]) {
    fireEvent.click(target);
    expect(row.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(target);
    expect(row.getAttribute("aria-selected")).toBe("false");
  }
  const link = screen.getByRole("link", { name: "common.actions.open_in_new_tab" });
  expect(link.getAttribute("target")).toBe("_blank");
  fireEvent.click(link);
  expect(row.getAttribute("aria-selected")).toBe("false");
  fireEvent.click(title);
  fireEvent.click(link.querySelector("svg")!);
  expect(row.getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByText("issue.select.empty")).toBeNull();
  expect(screen.getAllByText("PRJ-42")).toHaveLength(1);
});
