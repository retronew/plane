/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { EditorRefApi } from "@plane/editor";
import type { WritingAssistant } from "@/components/ai/writing-assistant";
import { EditorAIMenu } from "./menu";
const state = vi.hoisted(() => ({ props: null as ComponentProps<typeof WritingAssistant> | null }));
vi.mock("@/components/ai/writing-assistant", () => ({
  WritingAssistant: (props: ComponentProps<typeof WritingAssistant>) => {
    state.props = props;
    return null;
  },
}));
function setup(selection = "selected text") {
  const editor = {
    getDocument: vi.fn(() => ({ html: "<p>original</p>" })),
    getSelectedText: vi.fn(() => selection),
    getCurrentCursorPosition: vi.fn(() => 3),
    insertText: vi.fn(),
    setEditorValue: vi.fn(),
  };
  render(
    <EditorAIMenu
      editorRef={editor as unknown as EditorRefApi}
      isOpen
      onClose={vi.fn()}
      workspaceId="id"
      workspaceSlug="team"
      title="Page title"
    />
  );
  return { editor, props: state.props! };
}
describe("Page optimization integration", () => {
  it("supplies title, document and selection, and inserts only into that selection", () => {
    const { editor, props } = setup();
    const context = props.getContext();
    expect(context).toMatchObject({
      kind: "page",
      title: "Page title",
      document: "<p>original</p>",
      selection: "selected text",
    });
    expect(props.onApply("<p>new</p>", "replace", context)).toBe(true);
    expect(editor.insertText).toHaveBeenCalledWith("<p>new</p>", false);
    props.onUndo(context);
    expect(editor.setEditorValue).toHaveBeenCalledWith("<p>original</p>", true);
  });
  it("rejects a moved selection or concurrent document edit", () => {
    const { editor, props } = setup();
    const context = props.getContext();
    editor.getCurrentCursorPosition.mockReturnValue(8);
    expect(props.onApply("result", "replace", context)).toBe(false);
    editor.getCurrentCursorPosition.mockReturnValue(3);
    editor.getDocument.mockReturnValue({ html: "collaborator edit" });
    expect(props.onApply("result", "replace", context)).toBe(false);
    expect(editor.insertText).not.toHaveBeenCalled();
  });
  it("appends to the whole document when there is no selection and emits the update", () => {
    const { editor, props } = setup("");
    expect(props.onApply("<p>new</p>", "append", props.getContext())).toBe(true);
    expect(editor.setEditorValue).toHaveBeenCalledWith("<p>original</p><p>new</p>", true);
  });
});
