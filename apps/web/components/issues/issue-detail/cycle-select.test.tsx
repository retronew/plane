import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { IssueCycleSelect } from "./cycle-select";

const mocks = vi.hoisted(() => ({
  issue: { id: "issue", cycle_id: "original" },
  toast: vi.fn(),
}));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => mocks.issue } }),
}));
vi.mock("@/components/dropdowns/cycle/cycle-select", () => ({
  CycleSelect: (props: {
    value: string | null;
    disabled: boolean;
    onChange: (value: string | null) => Promise<void>;
  }) => (
    <select
      aria-label="Cycle"
      value={props.value ?? ""}
      disabled={props.disabled}
      onChange={(event) => void props.onChange(event.target.value || null)}
    >
      <option value="">No cycle</option>
      <option value="original">Original cycle</option>
      <option value="next">Next cycle</option>
    </select>
  ),
}));

beforeEach(() => {
  mocks.toast.mockReset();
});

it.each([
  { operation: "addCycleToIssue", selection: "next", cycleId: "next", message: "issue.add.cycle.failed" },
  { operation: "removeIssueFromCycle", selection: "", cycleId: "original", message: "issue.remove.cycle.failed" },
] as const)("recovers from $operation failure and allows retry", async ({ operation, selection, cycleId, message }) => {
  let rejectFirst!: (reason: Error) => void;
  let resolveRetry!: () => void;
  const update = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        })
    )
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        })
    );
  render(
    <IssueCycleSelect
      workspaceSlug="workspace"
      projectId="project"
      issueId="issue"
      issueOperations={{ fetch: vi.fn(), update: vi.fn(), remove: vi.fn(), [operation]: update }}
    />
  );
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Cycle" });

  fireEvent.change(select, { target: { value: selection } });
  expect(select.disabled).toBe(true);
  expect(update).toHaveBeenCalledExactlyOnceWith("workspace", "project", cycleId, "issue");

  await act(async () => rejectFirst(new Error("Request failed")));
  expect(select.disabled).toBe(false);
  expect(select.value).toBe("original");
  expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
    type: "error",
    title: "common.error.label",
    message,
  });

  fireEvent.change(select, { target: { value: selection } });
  expect(select.disabled).toBe(true);
  expect(update).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenLastCalledWith("workspace", "project", cycleId, "issue");
  await act(async () => resolveRetry());
  expect(select.disabled).toBe(false);
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});
