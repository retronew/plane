import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TProjectIssueType, TProjectWorkflow } from "@plane/types";
import { TypesEditor } from "./types-editor";
import { TypesActions } from "./types-actions";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  Logo: () => null,
  EmojiPicker: ({
    buttonClassName,
    label,
    disabled,
  }: {
    buttonClassName: string;
    label: ReactNode;
    disabled: boolean;
  }) => (
    <button type="button" className={buttonClassName} disabled={disabled}>
      {label}
    </button>
  ),
}));
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  vi.unstubAllGlobals();
});
const type: TProjectIssueType = {
  id: "task",
  project_issue_type_id: "project-task",
  name: "Task",
  description: "Work to do",
  is_default: false,
  is_active: true,
  workflow_id: null,
};
function setup(value: Partial<TProjectIssueType> = {}, busy = false) {
  const props = {
    type: value,
    open: true,
    busy,
    onClose: vi.fn(),
    onClosed: vi.fn(),
    onSave: vi.fn().mockResolvedValue(type),
  };
  return { ...render(<TypesEditor {...props} />), props };
}

it.each<Partial<TProjectIssueType>>([{}, type])(
  "uses the same labeled, padded form and footer for creation and editing: %j",
  (value) => {
    setup(value);
    const dialog = screen.getByRole("dialog");
    const name = screen.getByRole<HTMLInputElement>("textbox", { name: "name" });
    const description = screen.getByRole("textbox", { name: "description" });
    expect(name.getAttribute("placeholder")).toBe("web.workflow_ui.types_settings.name_placeholder");
    expect(name.labels?.length).toBe(1);
    expect(description.className).toContain("px-3 py-2");
    expect(description.parentElement?.className).toContain("h-[96px]");
    expect(description.parentElement?.className).toContain("resize-none");
    const icon = screen.getByRole("button", { name: "web.workflow_ui.types_settings.choose_icon" });
    expect(icon.className).toContain("size-8");
    expect(icon.parentElement?.className).toContain("items-end");
    expect(dialog.className).toContain("w-168");
    expect(screen.queryByRole("combobox")).toBeNull();
    const submit = screen.getByRole("button", { name: value.id ? "save" : "web.workflow_ui.types_settings.add" });
    expect(submit.getAttribute("form")).toBe(name.closest("form")?.id);
    expect(submit.parentElement?.parentElement).toBe(name.closest("form")?.parentElement?.parentElement?.parentElement);
  }
);

it.each<Partial<TProjectIssueType>>([{}, type])(
  "trims names and saves only type metadata for creation and editing: %j",
  async (value) => {
    const { props } = setup(value);
    const name = screen.getByRole("textbox", { name: "name" });
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.submit(name.closest("form")!);
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "  Bug  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "Defect" } });
    fireEvent.click(screen.getByRole("button", { name: value.id ? "save" : "web.workflow_ui.types_settings.add" }));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith(
        {
          name: "Bug",
          description: "Defect",
          logo_props: { in_use: "icon", icon: { name: "circle", color: "#6d7b8a" } },
        },
        value.id
      )
    );
  }
);

it("blocks edits, submission and dismissal while saving", () => {
  const { props } = setup(type, true);
  expect(screen.getByRole("textbox", { name: "name" }).matches(":disabled")).toBe(true);
  expect(screen.getByRole("textbox", { name: "description" }).matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  fireEvent.submit(screen.getByRole("textbox", { name: "name" }).closest("form")!);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(props.onClose).not.toHaveBeenCalled();
  expect(props.onSave).not.toHaveBeenCalled();
});

it("keeps dialog content through the exit animation", async () => {
  let finishAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [{ finished }] });
  const { props, rerender } = setup(type);
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
  rerender(<TypesEditor {...props} open={false} />);
  expect(dialog.isConnected).toBe(true);
  expect(dialog.hasAttribute("data-ending-style")).toBe(true);
  expect(props.onClosed).not.toHaveBeenCalled();
  await act(async () => finishAnimation());
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(props.onClosed).toHaveBeenCalled();
});

const workflow: TProjectWorkflow = {
  id: "project-flow",
  workflow_id: "flow",
  name: "Custom workflow",
  enabled: true,
  is_active: true,
  initial_state_id: null,
  effective_initial_state_id: null,
  can_manage: true,
  states: [],
  transitions: [],
};
async function openBinding() {
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions Task" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "common.workflows" }));
  return screen.findByRole("dialog", { name: "common.workflows" });
}
async function chooseWorkflow(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "common.workflows" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
it.each([null, "flow"])("previews workflow bindings through the independent action from %s", async (workflowId) => {
  const onPreview = vi.fn().mockResolvedValue(undefined),
    onSave = vi.fn();
  render(
    <TypesActions
      type={{ ...type, workflow_id: workflowId }}
      canManage
      busy={false}
      workflows={[workflow]}
      onEdit={vi.fn()}
      onSave={onSave}
      onPreview={onPreview}
    />
  );
  const dialog = await openBinding();
  const preview = within(dialog).getByRole("button", { name: "web.workflow_ui.impact_title" });
  expect(preview.matches(":disabled")).toBe(true);
  await chooseWorkflow(workflowId ? "web.workflow_ui.default_name" : "Custom workflow");
  fireEvent.click(preview);
  await waitFor(() =>
    expect(onPreview).toHaveBeenCalledWith({
      operation: "bind_type",
      type_id: type.id,
      workflow_id: workflowId ? undefined : "flow",
    })
  );
  expect(onSave).not.toHaveBeenCalled();
});
