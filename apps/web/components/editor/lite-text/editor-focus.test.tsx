import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiteTextEditor } from "./editor";

const calls = vi.hoisted(() => ({ focus: vi.fn() }));
vi.mock("@plane/editor/plate", async () => {
  const React = await import("react");
  return {
    PlateEditorWithRef: React.forwardRef(function Editor(props: { editable: boolean }, ref) {
      React.useImperativeHandle(ref, () => ({ focus: calls.focus }), []);
      return (
        <div data-slate-editor="" contentEditable={props.editable} suppressContentEditableWarning>
          Text
        </div>
      );
    }),
  };
});
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/utils", () => ({
  cn: (...values: unknown[]) => values.filter((x) => typeof x === "string").join(" "),
  isCommentEmpty: () => true,
}));
vi.mock("@/hooks/editor", () => ({
  useEditorConfig: () => ({ getEditorFileHandlers: () => ({}) }),
  useEditorMention: () => ({ fetchMentions: vi.fn() }),
}));
vi.mock("@/hooks/use-editor-flagging", () => ({
  useEditorFlagging: () => ({ liteText: { disabled: [], flagged: [] } }),
}));
vi.mock("@/hooks/use-parse-editor-content", () => ({ useParseEditorContent: () => ({ getEditorMetaData: vi.fn() }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/services/workspace.service", () => ({ WorkspaceService: vi.fn(function WorkspaceService() {}) }));
vi.mock("@/components/editor/embeds/mentions", () => ({ EditorMentionsRoot: () => null }));
vi.mock("./toolbar", () => ({
  IssueCommentToolbar: () => (
    <div>
      <button>Submit</button>
      <span data-testid="toolbar-space" />
    </div>
  ),
}));
vi.mock("./lite-toolbar", () => ({ LiteToolbar: () => <button>Submit</button> }));
afterEach(() => {
  cleanup();
  calls.focus.mockClear();
});
const props = {
  id: "comment",
  initialValue: "<p></p>",
  workspaceId: "w",
  workspaceSlug: "w",
  uploadFile: vi.fn(),
  duplicateFile: vi.fn(),
};

it.each(["full", "lite", "none"] as const)(
  "focuses the full %s input surface without stealing content or button clicks",
  (variant) => {
    const view = render(
      <LiteTextEditor {...props} editable variant={variant} compactCommentToolbar={variant === "full"} />
    );
    const wrapper = view.container.querySelector("[data-comment-editor]")!;
    fireEvent.mouseDown(wrapper, { button: 0 });
    expect(calls.focus).toHaveBeenCalledWith("end");
    calls.focus.mockClear();
    fireEvent.mouseDown(view.container.querySelector("[data-slate-editor]")!, { button: 0 });
    expect(calls.focus).not.toHaveBeenCalled();
    const button = view.queryByText("Submit");
    if (button) fireEvent.mouseDown(button, { button: 0 });
    expect(calls.focus).not.toHaveBeenCalled();
  }
);
it("focuses comment whitespace inside a dialog without treating the ancestor dialog as a toolbar", () => {
  const view = render(
    <dialog open>
      <LiteTextEditor {...props} editable />
    </dialog>
  );
  fireEvent.mouseDown(view.container.querySelector("[data-comment-editor]")!, { button: 0 });
  expect(calls.focus).toHaveBeenCalledWith("end");
});
it("does not steal clicks on toolbar whitespace or focus read-only comments", () => {
  const view = render(<LiteTextEditor {...props} editable />);
  fireEvent.mouseDown(view.getByTestId("toolbar-space"), { button: 0 });
  expect(calls.focus).not.toHaveBeenCalled();
  view.rerender(<LiteTextEditor {...props} editable={false} />);
  fireEvent.mouseDown(view.container.firstElementChild!, { button: 0 });
  expect(calls.focus).not.toHaveBeenCalled();
});
