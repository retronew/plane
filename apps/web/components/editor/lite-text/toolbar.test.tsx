import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import { setLanguage } from "@plane/i18n";
import { pickCommentImage } from "./comment-image-picker";
import { IssueCommentToolbar } from "./toolbar";

vi.mock("./comment-image-picker", () => ({ pickCommentImage: vi.fn() }));

const labels = {
  en: [
    "Bold",
    "Italic",
    "Underline",
    "Strikethrough",
    "Align left",
    "Align center",
    "Align right",
    "Numbered list",
    "Bulleted list",
    "To-do list",
    "Quote",
    "Code",
    "Image",
  ],
  "zh-CN": [
    "加粗",
    "斜体",
    "下划线",
    "删除线",
    "左对齐",
    "居中对齐",
    "右对齐",
    "编号列表",
    "项目符号列表",
    "待办事项列表",
    "引用",
    "代码",
    "图片",
  ],
};

function fixture(overrides: Partial<ComponentProps<typeof IssueCommentToolbar>> = {}) {
  const executeMenuItemCommand = vi.fn();
  const editorRef = {
    isMenuItemActive: ({ itemKey }: { itemKey: string }) => itemKey === "bold",
    isEditorReadyToDiscard: () => true,
    onStateChange: () => () => undefined,
    executeMenuItemCommand,
  } as unknown as EditorRefApi;
  const props = {
    editorRef,
    executeCommand: vi.fn(),
    handleSubmit: vi.fn(),
    isCommentEmpty: false,
    isSubmitting: false,
    showAccessSpecifier: false,
    showSubmitButton: false,
    compact: true,
    ...overrides,
  };
  return { props, executeMenuItemCommand, ...render(<IssueCommentToolbar {...props} />) };
}

afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  await setLanguage("en");
});

it.each((["en", "zh-CN"] as const).flatMap((language) => labels[language].map((expected) => ({ language, expected }))))(
  "translates button and tooltip $expected in $language",
  async ({ language, expected }) => {
    await setLanguage(language);
    fixture();
    expect(screen.getAllByRole("button")).toHaveLength(13);
    for (const name of labels[language]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-label")).not.toContain("web.");
      expect(button.getAttribute("aria-pressed")).toBe(name === labels[language][0] ? "true" : "false");
    }
    const button = screen.getByRole("button", { name: expected });
    fireEvent.mouseEnter(button);
    fireEvent.mouseMove(button);
    // Tooltips also include keyboard shortcuts where applicable.
    expect((await screen.findByRole("tooltip")).textContent).toContain(expected);
  }
);

it("tracks editor transactions and replaces subscriptions when the editor changes", () => {
  let activeItem = "bold";
  let readyToDiscard = true;
  let notify: () => void = () => undefined;
  const unsubscribe = vi.fn();
  const editorRef = {
    isMenuItemActive: ({ itemKey }: { itemKey: string }) => itemKey === activeItem,
    isEditorReadyToDiscard: () => readyToDiscard,
    onStateChange: vi.fn((callback: () => void) => {
      notify = callback;
      return unsubscribe;
    }),
  } as unknown as EditorRefApi;
  const { props, rerender, unmount } = fixture({ editorRef, showSubmitButton: true });
  expect((screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement).disabled).toBe(false);
  act(() => {
    readyToDiscard = false;
    notify();
  });
  expect((screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
  act(() => {
    activeItem = "italic";
    notify();
  });
  expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Italic" }).getAttribute("aria-pressed")).toBe("true");
  const replacementUnsubscribe = vi.fn();
  const replacement = {
    ...editorRef,
    isMenuItemActive: () => false,
    onStateChange: vi.fn(() => replacementUnsubscribe),
  } as EditorRefApi;
  rerender(<IssueCommentToolbar {...props} editorRef={replacement} />);
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Italic" }).getAttribute("aria-pressed")).toBe("false");
  unmount();
  expect(replacementUnsubscribe).toHaveBeenCalledOnce();
});

it("delegates image selection without executing an empty image block command", () => {
  const { props, executeMenuItemCommand } = fixture();
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  expect(pickCommentImage).toHaveBeenCalledExactlyOnceWith(props.editorRef);
  expect(props.executeCommand).not.toHaveBeenCalled();
  expect(executeMenuItemCommand).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Italic" }));
  expect(props.executeCommand).toHaveBeenCalledWith(expect.objectContaining({ itemKey: "italic" }));
});

it.each([true, false])("keeps submit disabled/loading semantics with compact=%s", (compact) => {
  const { props, rerender } = fixture({ compact, showSubmitButton: true, isCommentEmpty: true });
  let submit = screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement;
  expect(submit.type).toBe("submit");
  expect(submit.disabled).toBe(true);
  rerender(<IssueCommentToolbar {...props} isCommentEmpty={false} />);
  submit = screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  expect(props.handleSubmit).toHaveBeenCalledOnce();
  rerender(<IssueCommentToolbar {...props} isCommentEmpty={false} isSubmitting />);
  expect(submit.getAttribute("aria-busy")).toBe("true");
  rerender(<IssueCommentToolbar {...props} isCommentEmpty={false} editorRef={null} />);
  expect(submit.disabled).toBe(true);
});

it("keeps attachment and submit actions without a fixed formatting toolbar", () => {
  const { props } = fixture({ showFormatting: false, showSubmitButton: true });
  expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  expect(pickCommentImage).toHaveBeenCalledExactlyOnceWith(props.editorRef);
  fireEvent.click(screen.getByRole("button", { name: "Comment" }));
  expect(props.handleSubmit).toHaveBeenCalledOnce();
});
