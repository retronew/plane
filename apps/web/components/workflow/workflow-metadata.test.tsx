import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { WorkflowMetadata } from "./workflow-metadata";
const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), refresh: vi.fn(), set: vi.fn(), toast: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ service: mocks, set: mocks.set, refresh: mocks.refresh, lists: {} }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getProjectStateIds: () => [], getStateById: () => undefined }),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Part,
    DialogContent: Part,
    DialogMain: Part,
    DialogHeader: Part,
    DialogHeading: Part,
    DialogTitle: Part,
    DialogBody: Part,
    DialogActions: Part,
  };
});
vi.mock("@makeplane/propel/components/input-field", () => ({
  InputField: ({ label, value }: { label: string; value: string }) => (
    <input aria-label={label} value={value} readOnly />
  ),
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
const workflow = {
  id: "flow",
  version: 1,
  name: "Flow",
  description: "",
  states: [{ id: "source" }],
  is_default: true,
} as TProjectWorkflow;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({ ...workflow, version: 2 });
  mocks.refresh.mockResolvedValue(undefined);
});
it("updates shared data but does not close an unmounted dialog", async () => {
  let finish!: (result: TProjectWorkflow) => void;
  mocks.update.mockImplementation(
    () =>
      new Promise<TProjectWorkflow>((resolve) => {
        finish = resolve;
      })
  );
  const onClose = vi.fn();
  const { unmount } = render(
    <WorkflowMetadata workflow={workflow} workspaceSlug="w" projectId="p" onClose={onClose} onPreview={vi.fn()} />
  );
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  unmount();
  const updated = { ...workflow, version: 2 };
  await act(async () => finish(updated));
  expect(mocks.set).toHaveBeenCalledWith("p", updated);
  expect(onClose).not.toHaveBeenCalled();
});

it("recovers after a save fails and allows a retry", async () => {
  mocks.update.mockRejectedValueOnce(new Error("save failed")).mockResolvedValueOnce({ ...workflow, version: 2 });
  const onClose = vi.fn();
  render(
    <WorkflowMetadata workflow={workflow} workspaceSlug="w" projectId="p" onClose={onClose} onPreview={vi.fn()} />
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "save" })));
  expect(mocks.toast).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "save" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "save" })));
  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledTimes(1);
});
