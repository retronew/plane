import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IssueFormProps } from "./form";

const mocks = vi.hoisted(() => ({ createIssue: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/context/use-issue-modal", () => ({ useIssueModal: () => ({}) }));
vi.mock("@/hooks/store/workspace-draft", () => ({ useWorkspaceDraftIssues: () => mocks }));
vi.mock("./form", () => ({
  IssueFormRoot: ({ onDiscard, onClose }: { onDiscard: () => void; onClose: () => void }) => (
    <>
      <button onClick={onDiscard}>Discard</button>
      <button onClick={onClose}>Close</button>
    </>
  ),
}));
vi.mock("../confirm-issue-discard", () => ({
  ConfirmIssueDiscard: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Save draft?</div> : null),
}));
import { DraftIssueLayout } from "./draft-issue-layout";

const defaults: IssueFormProps = {
  issueTitleRef: { current: null },
  isCreateMoreToggleEnabled: false,
  onAssetUpload: vi.fn(),
  onCreateMoreToggleChange: vi.fn(),
  onClose: vi.fn(),
  onSubmit: async () => {},
  projectId: "project",
  isDraft: false,
  isDuplicateModalOpen: false,
  handleDuplicateIssueModal: vi.fn(),
};
describe("new work item discard", () => {
  it("clears unsaved changes and closes directly without creating a draft", () => {
    const onChange = vi.fn(),
      onClose = vi.fn();
    render(
      <DraftIssueLayout {...defaults} changesMade={{ name: "Unsaved item" }} onChange={onChange} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Discard"));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.createIssue).not.toHaveBeenCalled();
    expect(screen.queryByText("Save draft?")).toBeNull();
  });
  it("keeps the save-draft prompt for ordinary close", () => {
    const onChange = vi.fn(),
      onClose = vi.fn();
    render(
      <DraftIssueLayout {...defaults} changesMade={{ name: "Unsaved item" }} onChange={onChange} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Close"));
    expect(screen.getByText("Save draft?")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
