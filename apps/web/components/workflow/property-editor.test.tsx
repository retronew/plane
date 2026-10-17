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
  const option = await screen.findByRole("option", { name: label(`types.${type}`) });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

it("blocks whitespace titles and saves a trimmed title with the edited description", async () => {
  const { props } = setup({ ...draft, name: "" });
  const title = screen.getByRole("textbox", { name: label("title") });
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
  const required = screen.getByRole("checkbox", { name: label("required") }) as HTMLInputElement;
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
  fireEvent.click(screen.getByRole("radio", { name: label("read_only") }));
  const required = screen.getByRole("checkbox", { name: label("required") }) as HTMLInputElement;
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
  expect((screen.getByRole("textbox", { name: label("title") }) as HTMLInputElement).matches(":disabled")).toBe(true);
  expect(screen.getByRole("checkbox", { name: label("active") }).getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  fireEvent.submit(screen.getByRole("textbox", { name: label("title") }).closest("form")!);
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
      config: { multiple: true },
      options: [expect.objectContaining({ name: "High", sort_order: 1 })],
    })
  );
});

it("saves numeric defaults as numbers and clearing them as null", async () => {
  const { props } = setup({ ...draft, property_type: "number", config: { default_value: 3 } });
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
