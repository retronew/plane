import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TemplateWorkItemChild } from "@/services/workspace-configuration.service";
import { TemplateChildren } from "./children";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./work-item-fields", () => ({
  TemplateWorkItemFields: ({
    value,
    onChange,
    workspaceSlug,
    projectId,
  }: {
    value: TemplateWorkItemChild;
    onChange: (patch: Partial<TemplateWorkItemChild>) => void;
    workspaceSlug: string;
    projectId: string;
  }) => (
    <div data-testid="child-scope" data-workspace={workspaceSlug} data-project={projectId}>
      <input aria-label="Child title" value={value.name} onChange={(event) => onChange({ name: event.target.value })} />
      <textarea
        aria-label="Child body"
        value={value.description_html}
        onChange={(event) => onChange({ description_html: event.target.value })}
      />
    </div>
  ),
}));
const onChange = vi.fn();
const child = (name = "Existing child"): TemplateWorkItemChild => ({
  client_id: name,
  name,
  description_html: "<p>Original body</p>",
  type_id: "bug",
  state_id: "todo",
  priority: "high",
  assignee_ids: ["member"],
  label_ids: ["label"],
});
function Harness({ initial, disabled = false }: { initial?: TemplateWorkItemChild[]; disabled?: boolean }) {
  const [items, setItems] = useState<TemplateWorkItemChild[]>(() => initial ?? []);
  return (
    <TemplateChildren
      items={items}
      disabled={disabled}
      workspaceSlug="w"
      projectId="p"
      onChange={(next) => {
        onChange(next);
        setItems(next);
      }}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

it("ignores canceled child edits and preserves existing work item properties when saving a rename", async () => {
  render(<Harness initial={[child()]} />);
  fireEvent.click(screen.getByRole("button", { name: "Existing child" }));
  let dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByTestId("child-scope").getAttribute("data-project")).toBe("p");
  expect(within(dialog).getByTestId("child-scope").getAttribute("data-workspace")).toBe("w");
  fireEvent.change(within(dialog).getByLabelText("Child title"), { target: { value: "Canceled title" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Existing child" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Existing child" }));
  dialog = await screen.findByRole("dialog");
  expect((within(dialog).getByLabelText("Child title") as HTMLInputElement).value).toBe("Existing child");
  fireEvent.change(within(dialog).getByLabelText("Child title"), { target: { value: "  Saved title  " } });
  fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
  expect(onChange).toHaveBeenLastCalledWith([{ ...child(), name: "Saved title" }]);
});

it("requires a nonempty child title and creates a fresh draft after closing", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "web.project_template_add_child" }));
  let dialog = await screen.findByRole("dialog");
  expect((within(dialog).getByRole("button", { name: "save" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Child title"), { target: { value: "   " } });
  expect((within(dialog).getByRole("button", { name: "save" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Child title"), { target: { value: "Discarded child" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "web.project_template_add_child" }));
  dialog = await screen.findByRole("dialog");
  expect((within(dialog).getByLabelText("Child title") as HTMLInputElement).value).toBe("");
  expect(onChange).not.toHaveBeenCalled();
});

it("removes only the selected child and keeps the remaining item intact", () => {
  render(<Harness initial={[child("First"), child("Second")]} />);
  const row = screen.getByRole("button", { name: "First" }).closest("li")!;
  fireEvent.click(within(row).getByRole("button", { name: "delete" }));
  expect(onChange).toHaveBeenLastCalledWith([child("Second")]);
  expect(screen.queryByRole("button", { name: "First" })).toBeNull();
  expect(screen.getByRole("button", { name: "Second" })).toBeTruthy();
});

it("disables child mutation controls during parent submission", () => {
  render(<Harness initial={[child()]} disabled />);
  for (const name of ["web.project_template_add_child", "web.project_template_edit_child", "Existing child", "delete"])
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});

it("caps creation at fifty children while allowing edits and deletion", () => {
  render(<Harness initial={Array.from({ length: 50 }, (_, index) => child(`Child ${index}`))} />);
  expect((screen.getByRole("button", { name: "web.project_template_add_child" }) as HTMLButtonElement).disabled).toBe(
    true
  );
  const row = screen.getByRole("button", { name: "Child 0" }).closest("li")!;
  expect(
    (within(row).getByRole("button", { name: "web.project_template_edit_child" }) as HTMLButtonElement).disabled
  ).toBe(false);
  fireEvent.click(within(row).getByRole("button", { name: "delete" }));
  expect((screen.getByRole("button", { name: "web.project_template_add_child" }) as HTMLButtonElement).disabled).toBe(
    false
  );
});
