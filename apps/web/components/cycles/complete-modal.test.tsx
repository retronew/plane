import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { ICycle } from "@plane/types";
import { CycleCompleteModal } from "./complete-modal";

const mocks = vi.hoisted(() => ({ completeCycle: vi.fn(), getCycleById: vi.fn(), toast: vi.fn(), select: vi.fn() }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => mocks }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/dropdowns/cycle/cycle-select", () => ({
  CycleSelect: (props: {
    disabled?: boolean;
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
  }) => {
    mocks.select(props);
    return (
      <button disabled={props.disabled} onClick={() => props.onChange("target")}>
        {props.value ?? props.placeholder}
      </button>
    );
  },
}));
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  cycleId: "source",
  cycleName: "Sprint 1",
  open: true,
};
const source = {
  id: "source",
  status: "current",
  backlog_issues: 2,
  unstarted_issues: 3,
  started_issues: 1,
  completed_issues: 4,
  cancelled_issues: 2,
} as ICycle;

beforeEach(async () => {
  vi.clearAllMocks();
  await setLanguage("en");
  mocks.getCycleById.mockReturnValue(source);
  mocks.completeCycle.mockResolvedValue({});
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(() => vi.unstubAllGlobals());

it("shows the incomplete count excluding completed/cancelled work and completes with keep by default", async () => {
  const onClose = vi.fn();
  render(<CycleCompleteModal {...props} onClose={onClose} />);
  expect(await screen.findByRole("dialog", { name: "Choose how to handle incomplete work items." })).toBeTruthy();
  expect(
    screen.getByText(
      "There are 6 incomplete work items in this cycle. You can move them to an upcoming cycle or leave them as is."
    )
  ).toBeTruthy();
  expect(
    screen.getByRole("radio", { name: "Leave pending work items in this cycle." }).getAttribute("aria-checked")
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Complete cycle" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(mocks.completeCycle).toHaveBeenCalledWith("workspace", "project", "source", { incomplete_action: "keep" });
});

it("requires an upcoming target and passes the selector constraints before transferring", async () => {
  render(<CycleCompleteModal {...props} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Transfer pending work items to an upcoming cycle." }));
  const submit = screen.getByRole("button", { name: "Complete cycle" });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.select).toHaveBeenLastCalledWith(
    expect.objectContaining({
      projectId: "project",
      variant: "select-md",
      status: ["upcoming"],
      excludeIds: ["source"],
      clearable: false,
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Select cycle" }));
  fireEvent.click(submit);
  await waitFor(() =>
    expect(mocks.completeCycle).toHaveBeenCalledWith("workspace", "project", "source", {
      incomplete_action: "transfer",
      target_cycle_id: "target",
    })
  );
});

it("derives incomplete work from list totals when grouped counts are absent", async () => {
  mocks.getCycleById.mockReturnValue({ id: "source", total_issues: 16, completed_issues: 4, cancelled_issues: 2 });
  render(<CycleCompleteModal {...props} onClose={vi.fn()} />);
  expect(
    await screen.findByText(
      "There are 10 incomplete work items in this cycle. You can move them to an upcoming cycle or leave them as is."
    )
  ).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Leave pending work items in this cycle." })).toBeTruthy();
});

it("requires confirmation with no incomplete work items", async () => {
  mocks.getCycleById.mockReturnValue({ ...source, backlog_issues: 0, unstarted_issues: 0, started_issues: 0 });
  render(<CycleCompleteModal {...props} onClose={vi.fn()} />);
  expect(await screen.findByText("There are no incomplete work items. Confirm to complete this cycle.")).toBeTruthy();
  expect(mocks.completeCycle).not.toHaveBeenCalled();
  expect(screen.queryByRole("radio")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Complete cycle" }));
  await waitFor(() =>
    expect(mocks.completeCycle).toHaveBeenCalledWith("workspace", "project", "source", { incomplete_action: "keep" })
  );
});

it("prevents dismissal and repeat submission while pending, then keeps the dialog and choice on failure", async () => {
  let reject!: (error: Error) => void;
  mocks.completeCycle.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  const onClose = vi.fn();
  render(<CycleCompleteModal {...props} onClose={onClose} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Transfer pending work items to an upcoming cycle." }));
  fireEvent.click(screen.getByRole("button", { name: "Select cycle" }));
  const submit = screen.getByRole("button", { name: "Complete cycle" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  expect(mocks.completeCycle).toHaveBeenCalledOnce();
  expect((screen.getByRole("button", { name: "target" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error("Failed")));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith({
      type: "error",
      title: "Could not complete the cycle. Please try again.",
    })
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("button", { name: "target" })).toBeTruthy();
  expect((submit as HTMLButtonElement).disabled).toBe(false);
});

it("allows cancellation without a completion request", async () => {
  const onClose = vi.fn();
  render(<CycleCompleteModal {...props} onClose={onClose} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(mocks.completeCycle).not.toHaveBeenCalled();
});
