import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PropertyMergeDialog } from "./property-merge-dialog";
import type { TCustomProperty } from "@/services/project/custom-properties.service";

const locale = vi.hoisted(() => ({ confirmationWord: "Confirm" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count: number }) =>
      key.endsWith(".confirmation_word") ? locale.confirmationWord : params ? `${key}:${params.count}` : key,
  }),
}));
const label = (key: string) => `web.work_item_properties.merge.${key}`;
const property = (id: string, overrides: Partial<TCustomProperty> = {}): TCustomProperty => ({
  id,
  name: id,
  description: "",
  property_type: "text",
  config: {},
  is_active: true,
  is_required: false,
  sort_order: 0,
  options: [],
  options_version: "v1",
  type_settings: [],
  ...overrides,
});
function setup(properties = [property("a"), property("b", { is_active: false })]) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    properties,
    onPreview: vi.fn().mockResolvedValue({ work_items_count: 12, draft_count: 3, type_count: 2 }),
    onMerge: vi.fn().mockResolvedValue(true),
  };
  return { ...render(<PropertyMergeDialog {...props} />), props };
}
async function chooseType(name = "web.work_item_properties.types.text") {
  fireEvent.click(screen.getByRole("combobox"));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
}
function toggle(name: string) {
  const control = screen.getByRole("checkbox", { name });
  const input = control.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error("Expected Base UI checkbox input");
  fireEvent.click(input);
}
async function selectProperties() {
  await chooseType();
  toggle("a");
  toggle("b");
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  await screen.findByRole("textbox", { name: "web.work_item_properties.title" });
}
function confirm() {
  fireEvent.change(screen.getByRole("textbox", { name: "web.work_item_properties.title" }), {
    target: { value: "  Combined  " },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "New description" } });
  fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), {
    target: { value: locale.confirmationWord },
  });
}

it("preserves selection order through deselection and preview", async () => {
  const { props } = setup();
  await chooseType();
  toggle("b");
  toggle("a");
  toggle("b");
  expect((screen.getByRole("button", { name: label("continue") }) as HTMLButtonElement).disabled).toBe(true);
  toggle("b");
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith(["a", "b"]));
});
it("rejects selected IDs whose candidate disappears without rewriting the selection", async () => {
  const { props, rerender } = setup([property("a"), property("b"), property("c")]);
  await chooseType();
  toggle("b");
  toggle("a");
  rerender(<PropertyMergeDialog {...props} properties={[property("a"), property("c")]} />);
  expect((screen.getByRole("button", { name: label("continue") }) as HTMLButtonElement).disabled).toBe(true);
  expect(props.onPreview).not.toHaveBeenCalled();
  rerender(<PropertyMergeDialog {...props} />);
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith(["b", "a"]));
});
it("shows only groups with two properties, separates multiple mode, and includes inactive properties", async () => {
  setup([
    property("a"),
    property("b", { is_active: false }),
    property("number", { property_type: "number" }),
    property("single", { property_type: "dropdown" }),
    property("multi", { property_type: "dropdown", config: { multiple: true } }),
  ]);
  expect((screen.getByRole("button", { name: label("continue") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("combobox"));
  expect(await screen.findAllByRole("option")).toHaveLength(1);
  const option = screen.getByRole("option");
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  expect(screen.getByRole("checkbox", { name: "b" })).toBeTruthy();
});

it("requires two sources, previews counts, and requires the exact localized confirmation word before merging", async () => {
  const { props } = setup();
  await chooseType();
  toggle("a");
  expect((screen.getByRole("button", { name: label("continue") }) as HTMLButtonElement).disabled).toBe(true);
  toggle("b");
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  await screen.findByRole("textbox", { name: "web.work_item_properties.title" });
  expect(props.onPreview).toHaveBeenCalledWith(["a", "b"]);
  for (const [key, count] of [
    ["property_count", 2],
    ["work_items_count", 12],
    ["draft_count", 3],
    ["type_count", 2],
  ])
    expect(screen.getByText(`${label(String(key))}:${count}`)).toBeTruthy();
  const submit = screen.getByRole("button", { name: label("action") }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  confirm();
  fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), { target: { value: "Combined" } });
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), { target: { value: "confirm" } });
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), {
    target: { value: locale.confirmationWord },
  });
  fireEvent.click(submit);
  await waitFor(() =>
    expect(props.onMerge).toHaveBeenCalledWith({
      source_property_ids: ["a", "b"],
      name: "Combined",
      description: "New description",
    })
  );
  await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
});

it("uses the Chinese confirmation word and keeps confirmation valid after editing the new title", async () => {
  locale.confirmationWord = "确认";
  try {
    const { props } = setup();
    await selectProperties();
    confirm();
    fireEvent.change(screen.getByRole("textbox", { name: "web.work_item_properties.title" }), {
      target: { value: "New title" },
    });
    const submit = screen.getByRole("button", { name: label("action") }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), { target: { value: "Confirm" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: label("confirmation") }), { target: { value: "确认" } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(props.onMerge).toHaveBeenCalledWith({
        source_property_ids: ["a", "b"],
        name: "New title",
        description: "New description",
      })
    );
  } finally {
    locale.confirmationWord = "Confirm";
  }
});

it("renders the subtitle and lets the close button dismiss an idle dialog", () => {
  const { props } = setup();
  expect(screen.getByText(label("subtitle"))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

it("blocks overlapping inactive type bindings before preview", async () => {
  const binding = { type_id: "bug", project_issue_type_id: "binding", is_active: false, is_required: false };
  const { props } = setup([property("a", { type_settings: [binding] }), property("b", { type_settings: [binding] })]);
  await chooseType();
  toggle("a");
  toggle("b");
  expect(screen.getByRole("alert").textContent).toBe(label("overlap"));
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  expect(props.onPreview).not.toHaveBeenCalled();
});

it("displays backend preview conflicts and retains selection for retry", async () => {
  const { props } = setup();
  props.onPreview.mockRejectedValueOnce({
    response: { status: 400, data: { code: "CUSTOM_PROPERTY_MERGE_TYPE_BINDING_CONFLICT" } },
  });
  await chooseType();
  toggle("a");
  toggle("b");
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  expect((await screen.findByRole("alert")).textContent).toBe(label("overlap"));
  expect(screen.getByRole("checkbox", { name: "a" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: label("continue") }));
  await screen.findByRole("textbox", { name: "web.work_item_properties.title" });
});

it("keeps failed merges open with their input and prevents repeat submissions or dismissal while busy", async () => {
  const { props } = setup();
  let rejectMerge: (reason: unknown) => void = () => undefined;
  props.onMerge.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectMerge = reject;
      })
  );
  await selectProperties();
  confirm();
  const submit = screen.getByRole("button", { name: label("action") });
  fireEvent.click(submit);
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(props.onMerge).toHaveBeenCalledTimes(1);
  expect(props.onOpenChange).not.toHaveBeenCalled();
  rejectMerge({ response: { data: { code: "CUSTOM_PROPERTY_MERGE_VALUE_CONFLICT" } } });
  expect((await screen.findByRole("alert")).textContent).toBe(label("value_conflict"));
  expect((screen.getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe("New description");
  expect(props.onOpenChange).not.toHaveBeenCalled();
  fireEvent.click(submit);
  await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
});

it("retains the dialog when merge returns false and respects external busy", async () => {
  const { props, rerender } = setup();
  props.onMerge.mockResolvedValue(false);
  await selectProperties();
  confirm();
  fireEvent.click(screen.getByRole("button", { name: label("action") }));
  await screen.findByRole("alert");
  expect(props.onOpenChange).not.toHaveBeenCalled();
  rerender(<PropertyMergeDialog {...props} busy />);
  expect((screen.getByRole("button", { name: label("action") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(props.onOpenChange).not.toHaveBeenCalled();
});
