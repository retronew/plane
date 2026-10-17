import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IssueAttachmentUpload } from "./attachment-upload";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: 1024 }) }));

it("recovers after a rejected upload and allows the same file to be retried", async () => {
  const create = vi.fn().mockRejectedValueOnce(new Error("Storage unavailable")).mockResolvedValueOnce(undefined);
  const { container } = render(<IssueAttachmentUpload workspaceSlug="workspace" attachmentOperations={{ create }} />);
  const input = container.querySelector("input")!;
  const file = new File(["sample"], "notes.txt", { type: "text/plain" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(input.disabled).toBe(false));
  expect(screen.getByText("web.click_or_drag_a_file_here")).toBeTruthy();
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(input.disabled).toBe(false));
});

it("does not start an upload for a file above the size limit", async () => {
  const create = vi.fn();
  const { container } = render(<IssueAttachmentUpload workspaceSlug="workspace" attachmentOperations={{ create }} />);
  fireEvent.change(container.querySelector("input")!, {
    target: { files: [new File(["x".repeat(1025)], "large.txt", { type: "text/plain" })] },
  });
  await waitFor(() => expect(screen.getByText(/Invalid file type or size/)).toBeTruthy());
  expect(create).not.toHaveBeenCalled();
});
