import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageEditorHeaderRoot } from "./root";

const mocks = vi.hoisted(() => ({
  template: { title: "Title <template>", description_html: "<p>Template body</p>", configuration: {} },
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  EmojiPicker: ({ label, buttonClassName }: { label: React.ReactNode; buttonClassName: string }) => (
    <button className={buttonClassName}>{label}</button>
  ),
}));
vi.mock("@/components/settings/workspace/configuration/template-picker", () => ({
  TemplatePicker: ({
    onApply,
    disabled,
    projectId,
  }: {
    onApply: (template: unknown) => void;
    disabled: boolean;
    projectId: string;
  }) => (
    <button disabled={disabled} data-project={projectId} onClick={() => onApply(mocks.template)}>
      Apply template
    </button>
  ),
}));

beforeEach(() => vi.clearAllMocks());

function mount(editable = true) {
  const editor = { setEditorValue: vi.fn() };
  const titleEditor = { setEditorValue: vi.fn() };
  const page = {
    name: "Existing title",
    isContentEditable: editable,
    updatePageLogo: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    editor: { editorRef: editor },
  };
  const props = {
    page: page as unknown as TPageInstance,
    workspaceSlug: "workspace",
    projectId: "project",
    setTitle: titleEditor.setEditorValue,
    titleReady: true,
  };
  const result = render(<PageEditorHeaderRoot {...props} />);
  return { ...result, page, editor, titleEditor, props };
}

it("keeps the icon action visible for a named page and scopes templates to the project", () => {
  mount();
  const icon = screen.getByRole("button", { name: "web.icon" });
  expect(icon.closest('[class*="opacity-0"]')).toBeNull();
  expect(icon.querySelector("button")).toBeNull();
  expect(icon.className).toContain("h-7");
  expect(icon.className).toContain("whitespace-nowrap");
  expect(screen.getByRole("button", { name: "Apply template" }).getAttribute("data-project")).toBe("project");
});

it("applies metadata and replaces collaborative title/body with a plain-text collaborative title", async () => {
  const { page, editor, titleEditor } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
  await waitFor(() => expect(editor.setEditorValue).toHaveBeenCalledWith("<p>Template body</p>", true));
  expect(page.update).toHaveBeenCalledWith({});
  expect(titleEditor.setEditorValue).toHaveBeenCalledWith("Title <template>");
});

it("hides templates for read-only, locked or archived content", () => {
  mount(false);
  expect(screen.queryByRole("button", { name: "Apply template" })).toBeNull();
});

it("rechecks edit permission after metadata saves before modifying collaborative content", async () => {
  const { page, editor, titleEditor } = mount();
  page.update.mockImplementation(async () => {
    page.isContentEditable = false;
    return {};
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
  await waitFor(() => expect(page.update).toHaveBeenCalled());
  expect(editor.setEditorValue).not.toHaveBeenCalled();
  expect(titleEditor.setEditorValue).not.toHaveBeenCalled();
});

it("does not replace editor content when metadata saving fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { page, editor } = mount();
  page.update.mockRejectedValueOnce(new Error("Failed"));
  fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(editor.setEditorValue).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
