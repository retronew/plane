import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TCommentsOperations } from "@plane/types";
import { CommentCreate } from "./comment-create";

const editor = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-id" }) }),
}));
vi.mock("@/services/file.service", () => ({ FileService: vi.fn(function FileService() {}) }));
vi.mock("@/components/editor/lite-text", () => ({
  LiteTextEditor: (props: Record<string, unknown>) => {
    editor(props);
    return (
      <button onClick={() => (props.onChange as (json: object, html: string) => void)({}, "<p>Hello</p>")}>
        Write
      </button>
    );
  },
}));

it.each([{ variant: "compact" as const }, { isIntakeIssue: true }])(
  "shares the compact editor appearance for %j",
  (variant) => {
    render(
      <CommentCreate
        entityId="issue"
        workspaceSlug="workspace"
        activityOperations={{} as TCommentsOperations}
        {...variant}
      />
    );
    const props = editor.mock.lastCall?.[0];
    expect(props.compactCommentToolbar).toBe(true);
    expect(props.containerClassName).toContain("max-h-[200px] overflow-y-auto");
    expect(props.parentClassName).toContain("rounded-xl");
    expect(props.parentClassName).toContain("!p-0");
  }
);
it("keeps normal editor appearance by default and stores the same comment body", async () => {
  render(<CommentCreate entityId="issue" workspaceSlug="workspace" activityOperations={{} as TCommentsOperations} />);
  expect(editor.mock.lastCall?.[0].compactCommentToolbar).toBe(false);
  expect(editor.mock.lastCall?.[0].parentClassName).toBe("p-2");
  fireEvent.click(screen.getByText("Write"));
  await waitFor(() => expect(editor.mock.lastCall?.[0].initialValue).toBe("<p>Hello</p>"));
});
