import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PropertyEditor } from "./property-editor";
import type { PropertyDraft } from "./property-editor";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const label = (key: string) => `web.work_item_properties.${key}`;

// Base UI forwards root clicks as PointerEvents. JSDOM lacks their native checkbox
// activation, so use the associated real input while keeping all component handlers.
function clickControl(control: HTMLElement) {
  const input = control.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error("Expected the Base UI checkbox input");
  if (!input.disabled) fireEvent.click(input);
}

const draft: PropertyDraft = {
  name: "Estimate",
  description: "Planning",
  property_type: "text",
  config: {},
  is_active: true,
  is_required: true,
};
function setup(value: PropertyDraft = draft, busy = false) {
  const props = {
    open: true,
    draft: value,
    busy,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };
  const view = render(<PropertyEditor {...props} />);
  return { ...view, props };
}
async function chooseType(type: PropertyDraft["property_type"]) {
  fireEvent.click(screen.getByRole("combobox", { name: label("property_type") }));
  const option = await screen.findByRole("option", { name: new RegExp(label(`types.${type}`)) });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

it("starts without a selected type or configuration and blocks submission until a type is selected", async () => {
  const { props } = setup();
  const picker = screen.getByRole("combobox", { name: label("property_type") });
  expect(picker.textContent).toBe("web.workflow_ui.select_type");
  expect(screen.queryByRole("radio", { name: label("single_line") })).toBeNull();
  expect(screen.queryByText(label("text_format"))).toBeNull();
  const title = screen.getByRole("textbox", { name: label("name_label") });
  expect(title.getAttribute("placeholder")).toBe(label("name_placeholder"));
  expect(screen.getByRole("textbox", { name: "description" }).tagName).toBe("TEXTAREA");
  expect(screen.getByRole("button", { name: "description" }).getAttribute("aria-expanded")).toBe("true");
  expect((screen.getByRole("button", { name: label("create") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(title.closest("form")!);
  expect(props.onSave).not.toHaveBeenCalled();
  await chooseType("text");
  expect(screen.getByRole("radio", { name: label("single_line") }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(draft));
});

it("keeps existing fields selected and their type locked while allowing edits", async () => {
  const existing = { ...draft, id: "estimate" };
  const { props } = setup(existing);
  expect((screen.getByRole("combobox", { name: label("property_type") }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("radio", { name: label("single_line") }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  clickControl(screen.getByRole("switch", { name: label("active") }));
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({ ...existing, is_active: false }));
});

it("blocks whitespace titles and saves a trimmed title with the edited description", async () => {
  const { props } = setup({ ...draft, name: "" });
  await chooseType("text");
  const title = screen.getByRole("textbox", { name: label("name_label") });
  fireEvent.change(title, { target: { value: "   " } });
  expect((screen.getByRole("button", { name: label("create") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(title.closest("form")!);
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.change(title, { target: { value: "  Estimate  " } });
  fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "Sprint effort" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({ ...draft, name: "Estimate", description: "Sprint effort" })
  );
});

it("clears required and incompatible configuration when switching to boolean", async () => {
  const { props } = setup({ ...draft, config: { multiline: true } });
  await chooseType("boolean");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  const required = screen.getByRole("switch", { name: label("required") }) as HTMLInputElement;
  expect(required.getAttribute("aria-disabled")).toBe("true");
  expect(required.getAttribute("aria-checked")).toBe("false");
  clickControl(screen.getByRole("checkbox", { name: label("default_value") }));
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...draft,
      property_type: "boolean",
      is_required: false,
      config: { default_value: true },
    })
  );
});

it("makes read-only text non-required and requires a default before submitting", async () => {
  const { props } = setup();
  await chooseType("text");
  const readOnly = screen.getByRole("radio", { name: label("read_only") });
  const radioInput = readOnly.parentElement?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!radioInput) throw new Error("Expected the Base UI radio input");
  fireEvent.click(radioInput);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  const required = screen.getByRole("switch", { name: label("required") }) as HTMLInputElement;
  expect(required.getAttribute("aria-disabled")).toBe("true");
  expect(required.getAttribute("aria-checked")).toBe("false");
  const defaultValue = screen.getByRole("textbox", { name: label("default_value") }) as HTMLInputElement;
  expect(defaultValue.getAttribute("aria-required")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.change(defaultValue, { target: { value: "Fixed value" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...draft,
      is_required: false,
      config: { multiline: false, read_only: true, default_value: "Fixed value" },
    })
  );
});

it("locks the property type when editing and disables submission and dismissal while busy", () => {
  const { props } = setup({ ...draft, id: "estimate" }, true);
  expect((screen.getByRole("combobox", { name: label("property_type") }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).matches(":disabled")).toBe(
    true
  );
  expect((screen.getByRole("button", { name: new RegExp(label("more_settings")) }) as HTMLButtonElement).disabled).toBe(
    true
  );
  expect((screen.getByRole("button", { name: "close" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  fireEvent.submit(screen.getByRole("textbox", { name: label("name_label") }).closest("form")!);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(props.onClose).not.toHaveBeenCalled();
  expect(props.onSave).not.toHaveBeenCalled();
});

it("adds and removes initial dropdown options and preserves multi-select configuration", async () => {
  const { props } = setup();
  await chooseType("dropdown");
  clickControl(screen.getByRole("checkbox", { name: label("multiple") }));
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  fireEvent.change(screen.getByRole("textbox", { name: `${label("option_name")} 1` }), { target: { value: "Low" } });
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  fireEvent.change(screen.getByRole("textbox", { name: `${label("option_name")} 2` }), { target: { value: "High" } });
  fireEvent.click(screen.getAllByRole("button", { name: "remove" })[0]);
  expect(screen.queryByDisplayValue("Low")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...draft,
      property_type: "dropdown",
      config: { multiple: true, default_value: [] },
      options: [{ client_id: expect.any(String), name: "High", sort_order: 1 }],
    })
  );
});

it("focuses the name and keeps empty description and more settings collapsed", async () => {
  setup({ ...draft, description: "" });
  const name = screen.getByRole("textbox", { name: label("name_label") });
  await waitFor(() => expect(document.activeElement).toBe(name));
  const description = screen.getByRole("button", { name: label("add_description") });
  const settings = screen.getByRole("button", { name: new RegExp(label("more_settings")) });
  expect(description.getAttribute("aria-expanded")).toBe("false");
  expect(settings.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("textbox", { name: "description" })).toBeNull();
  expect(screen.queryByRole("switch", { name: label("active") })).toBeNull();
  fireEvent.click(description);
  expect(screen.getByRole("button", { name: "description" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "New description" } });
  expect((screen.getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe("New description");
});

it("shows all seven types with an icon and description", async () => {
  setup();
  fireEvent.click(screen.getByRole("combobox", { name: label("property_type") }));
  const options = await screen.findAllByRole("option");
  const types = ["text", "number", "dropdown", "boolean", "date", "member", "url"];
  expect(options).toHaveLength(types.length);
  for (const type of types) {
    const option = screen.getByRole("option", { name: new RegExp(label(`types.${type}`)) });
    expect(option.textContent).toContain(label(`type_descriptions.${type}`));
    expect(option.querySelector("svg")).not.toBeNull();
  }
});

it("restores a zero numeric default after switching to dropdown and back", async () => {
  const { props } = setup();
  await chooseType("number");
  fireEvent.change(screen.getByRole("spinbutton", { name: label("default_value") }), { target: { value: "0" } });
  await chooseType("dropdown");
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  fireEvent.change(screen.getByRole("textbox", { name: `${label("option_name")} 1` }), { target: { value: "Low" } });
  await chooseType("number");
  expect((screen.getByRole("spinbutton", { name: label("default_value") }) as HTMLInputElement).value).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...draft,
      property_type: "number",
      config: { default_value: 0 },
      options: undefined,
    })
  );
});

it.each([true, false])("restores required=%s after switching read-only text back to normal", async (isRequired) => {
  const { props } = setup({ ...draft, is_required: isRequired });
  await chooseType("text");
  const selectFormat = (format: string) => {
    const radio = screen.getByRole("radio", { name: label(format) });
    const input = radio.parentElement?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!input) throw new Error("Expected the Base UI radio input");
    fireEvent.click(input);
  };
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  selectFormat("read_only");
  expect(screen.getByRole("switch", { name: label("required") }).getAttribute("aria-checked")).toBe("false");
  selectFormat("single_line");
  const required = screen.getByRole("switch", { name: label("required") });
  expect(required.getAttribute("aria-checked")).toBe(String(isRequired));
  expect(required.getAttribute("aria-disabled")).not.toBe("true");
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...draft,
      is_required: isRequired,
      config: { multiline: false, read_only: false },
    })
  );
});

it("adds an option on Enter without submitting and blocks Enter on a blank option", async () => {
  const { props } = setup();
  await chooseType("dropdown");
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  const first = screen.getByRole("textbox", { name: `${label("option_name")} 1` });
  fireEvent.change(first, { target: { value: "Low" } });
  expect(fireEvent.keyDown(first, { key: "Enter", code: "Enter" })).toBe(false);
  const second = screen.getByRole("textbox", { name: `${label("option_name")} 2` });
  expect(fireEvent.keyDown(second, { key: "Enter", code: "Enter" })).toBe(false);
  expect(screen.queryByRole("textbox", { name: `${label("option_name")} 3` })).toBeNull();
  expect(props.onSave).not.toHaveBeenCalled();
});

it("blocks blank and case-insensitive duplicate option names with inline errors", async () => {
  const { props } = setup();
  await chooseType("dropdown");
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  const first = screen.getByRole("textbox", { name: `${label("option_name")} 1` });
  fireEvent.change(first, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  expect(screen.getByText(label("option_required"))).toBeDefined();
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.change(first, { target: { value: "Low" } });
  fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
  const second = screen.getByRole("textbox", { name: `${label("option_name")} 2` });
  fireEvent.change(second, { target: { value: " low " } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  expect(screen.getAllByText(label("option_duplicate"))).toHaveLength(2);
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.change(second, { target: { value: "High" } });
  expect(screen.queryByText(label("option_duplicate"))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
});

it.each([false, true])("clears a removed dropdown default when multiple=%s", async (multiple) => {
  const existing: PropertyDraft = {
    ...draft,
    id: "priority",
    property_type: "dropdown",
    config: { multiple, default_value: multiple ? ["low", "high"] : "low" },
    options: [
      { id: "low", name: "Low" },
      { id: "high", name: "High" },
    ],
  };
  const { props } = setup(existing);
  fireEvent.click(screen.getAllByRole("button", { name: "remove" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledWith({
      ...existing,
      config: { multiple, default_value: multiple ? ["high"] : null },
      options: [{ id: "high", name: "High" }],
    })
  );
});

it("keeps field input after a backend name error and allows retry", async () => {
  const { props } = setup();
  props.onSave.mockRejectedValueOnce({ response: { data: { name: ["This name already exists."] } } });
  await chooseType("number");
  fireEvent.change(screen.getByRole("spinbutton", { name: label("default_value") }), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await screen.findByText(label("invalid_name"));
  expect(screen.getByRole("textbox", { name: label("name_label") }).getAttribute("aria-invalid")).toBe("true");
  expect((screen.getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe("Estimate");
  expect((screen.getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe("Planning");
  expect((screen.getByRole("spinbutton", { name: label("default_value") }) as HTMLInputElement).value).toBe("0");
  expect(props.onClose).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: label("name_label") }), { target: { value: "Effort" } });
  expect(screen.queryByText(label("invalid_name"))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenLastCalledWith({
      ...draft,
      name: "Effort",
      property_type: "number",
      config: { default_value: 0 },
    })
  );
});

it("preserves the version and edited dropdown input on conflict without retrying", async () => {
  const existing: PropertyDraft = {
    ...draft,
    id: "priority",
    options_version: "v1",
    property_type: "dropdown",
    config: { default_value: "low" },
    options: [{ id: "low", name: "Low" }],
  };
  const { props } = setup(existing);
  props.onSave.mockRejectedValueOnce({
    response: { status: 409, data: { code: "CUSTOM_PROPERTY_OPTIONS_CONFLICT" } },
  });
  fireEvent.change(screen.getByRole("textbox", { name: label("name_label") }), { target: { value: "Priority" } });
  fireEvent.change(screen.getByRole("textbox", { name: `${label("option_name")} 1` }), { target: { value: "Lower" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await screen.findByText(label("options_conflict"));
  expect(props.onSave).toHaveBeenCalledTimes(1);
  expect(props.onSave).toHaveBeenCalledWith({
    ...existing,
    name: "Priority",
    options: [{ id: "low", name: "Lower" }],
  });
  expect((screen.getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe("Priority");
  expect((screen.getByRole("textbox", { name: `${label("option_name")} 1` }) as HTMLInputElement).value).toBe("Lower");
  expect(screen.getByRole("combobox", { name: label("default_value") }).textContent).toBe("Lower");
  expect(props.onClose).not.toHaveBeenCalled();
});

it("saves numeric defaults as numbers and clearing them as null", async () => {
  const { props } = setup();
  await chooseType("number");
  const input = screen.getByRole("spinbutton", { name: label("default_value") });
  fireEvent.change(input, { target: { value: "2.5" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenLastCalledWith({ ...draft, property_type: "number", config: { default_value: 2.5 } })
  );
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(props.onSave).toHaveBeenLastCalledWith({
      ...draft,
      property_type: "number",
      config: { default_value: null },
    })
  );
});
