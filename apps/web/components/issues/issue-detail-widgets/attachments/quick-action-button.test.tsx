import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
import { IssueAttachmentActionButton } from "./quick-action-button";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("react-dropzone", () => ({
  useDropzone: () => ({ open: mocks.open, getInputProps: () => ({ type: "file", hidden: true }) }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => ({}) }));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: 100 }) }));
vi.mock("./helper", () => ({ useAttachmentOperations: () => ({ operations: {} }) }));

it("uses the supplied toolbar button directly and keeps the file input outside it", () => {
  const parent = vi.fn();
  const { container, rerender } = render(
    <div onClick={parent} onKeyDown={parent} role="presentation">
      <IssueAttachmentActionButton
        workspaceSlug="workspace"
        projectId="project"
        issueId="issue"
        issueServiceType={EIssueServiceType.ISSUES}
        customButton={<button type="button">Attach</button>}
      />
    </div>
  );
  const button = screen.getByRole("button", { name: "Attach" });
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(button.querySelector("input,button")).toBeNull();
  expect(container.querySelector("input[type=file]")).not.toBeNull();
  fireEvent.click(button);
  expect(mocks.open).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
  rerender(
    <IssueAttachmentActionButton
      workspaceSlug="workspace"
      projectId="project"
      issueId="issue"
      issueServiceType={EIssueServiceType.ISSUES}
      disabled
      customButton={<button type="button">Attach</button>}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(mocks.open).toHaveBeenCalledTimes(1);
});
