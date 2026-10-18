import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkItemPropertiesSettings } from "./types-properties-settings";
import type { TCustomProperty, TCustomPropertyList } from "@/services/project/custom-properties.types";

const service = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  bindType: vi.fn(),
  remove: vi.fn(),
  saveOption: vi.fn(),
  removeOption: vi.fn(),
  previewMerge: vi.fn(),
  merge: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/services/project/custom-properties.service", () => ({
  CustomPropertiesService: class {
    list = service.list;
    save = service.save;
    bindType = service.bindType;
    remove = service.remove;
    saveOption = service.saveOption;
    removeOption = service.removeOption;
    previewMerge = service.previewMerge;
    merge = service.merge;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: toast }));

const label = (key: string) => `web.work_item_properties.${key}`;

// Base UI forwards root clicks as PointerEvents. JSDOM lacks their native checkbox
// activation, so use the associated real input while keeping all component handlers.
function clickControl(control: HTMLElement) {
  const input = control.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error("Expected the Base UI checkbox input");
  if (!input.disabled) fireEvent.click(input);
}

const property = (overrides: Partial<TCustomProperty> = {}): TCustomProperty => ({
  id: "estimate",
  name: "Estimate",
  description: "Planning effort",
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
const response = (results: TCustomProperty[] = [property()], can_manage = true): TCustomPropertyList => ({
  results,
  count: results.length,
  can_manage,
});
function setup(typeId?: string, onChanged?: () => Promise<unknown>) {
  return render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}
    >
      <WorkItemPropertiesSettings
        workspaceSlug="workspace"
        projectId="project"
        types={[]}
        typeId={typeId}
        onChanged={onChanged}
      />
    </SWRConfig>
  );
}
async function menu(name = "Estimate") {
  fireEvent.click(await screen.findByRole("button", { name: `${name} aria_labels.common.more_actions` }));
  return screen.findByRole("menu");
}
async function newProperty(typeId?: string) {
  if (typeId) {
    fireEvent.click(await screen.findByRole("button", { name: label("add_property") }));
    fireEvent.click(await screen.findByRole("menuitem", { name: label("create_new") }));
  } else fireEvent.click(await screen.findByRole("button", { name: label("add_new") }));
  return screen.findByRole("dialog");
}
async function chooseType(type: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label("property_type") }));
  const option = await screen.findByRole("option", { name: new RegExp(label(`types.${type}`)) });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
beforeEach(() => {
  vi.resetAllMocks();
  service.list.mockResolvedValue(response());
  service.save.mockResolvedValue(property({ id: "created" }));
  service.bindType.mockResolvedValue(property());
  service.remove.mockResolvedValue(undefined);
});

it.each([undefined, "bug"])("honors server can_manage=false in scope %s even when properties exist", async (typeId) => {
  service.list.mockResolvedValue(
    response(
      [
        property({
          type_settings: [
            { type_id: "bug", project_issue_type_id: "project-bug", is_active: true, is_required: false },
          ],
        }),
      ],
      false
    )
  );
  setup(typeId);
  const title = await screen.findByRole("button", { name: "Estimate" });
  expect((title as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: label("add_new") })).toBeNull();
  expect(screen.queryByRole("button", { name: label("add_property") })).toBeNull();
  expect(screen.queryByRole("button", { name: "Estimate aria_labels.common.more_actions" })).toBeNull();
  for (const control of screen.getAllByRole("switch")) {
    expect(control.getAttribute("aria-disabled")).toBe("true");
    clickControl(control);
  }
  fireEvent.click(title);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(service.save).not.toHaveBeenCalled();
  expect(service.bindType).not.toHaveBeenCalled();
});

it("uses the shared settings table frame, header height and data cell height", async () => {
  setup();
  await screen.findByRole("button", { name: "Estimate" });
  const table = screen.getByRole("table");
  expect(table.closest(".rounded-lg.border.border-subtle")).toBeTruthy();
  expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  expect(screen.getByRole("columnheader", { name: "aria_labels.common.more_actions" })).toBeTruthy();
  for (const header of screen.getAllByRole("columnheader")) {
    expect(header.classList.contains("h-9!")).toBe(true);
    expect(header.classList.contains("py-1!")).toBe(true);
  }
  for (const cell of screen.getAllByRole("cell")) expect(cell.classList.contains("h-11")).toBe(true);
  expect(within(table).getByText("Planning effort")).toBeTruthy();
});

it("does not expose management before load and retries a failed request through real SWR", async () => {
  service.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response());
  setup();
  expect(screen.queryByRole("button", { name: label("add_new") })).toBeNull();
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining(label("load_failed")));
  fireEvent.click(screen.getByRole("button", { name: label("retry") }));
  await screen.findByRole("button", { name: "Estimate" });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(service.list).toHaveBeenCalledTimes(2);
  expect(service.list).toHaveBeenLastCalledWith("workspace", "project", undefined);
});

it("searches case-insensitively with whitespace trimmed and recovers after no results", async () => {
  service.list.mockResolvedValue(response([property(), property({ id: "owner", name: "Owner" })]));
  setup();
  await screen.findByRole("button", { name: "Estimate" });
  // ExpandableSearch deliberately starts collapsed.
  const expand = screen.queryByRole("button", { name: "search" });
  if (expand) fireEvent.click(expand);
  const input = screen.getByRole("searchbox", { name: "search" });
  fireEvent.change(input, { target: { value: "  esTIMate  " } });
  expect(screen.getByRole("button", { name: "Estimate" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Owner" })).toBeNull();
  fireEvent.change(input, { target: { value: "missing" } });
  expect(screen.getByText(label("no_results"))).toBeTruthy();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Owner" })).toBeTruthy();
  expect(service.list).toHaveBeenCalledTimes(1);
});

it("prevents boolean/read-only required toggles but persists normal required changes", async () => {
  service.list.mockResolvedValue(
    response([
      property(),
      property({ id: "flag", name: "Flag", property_type: "boolean" }),
      property({ id: "fixed", name: "Fixed", config: { read_only: true } }),
    ])
  );
  setup();
  await screen.findByRole("button", { name: "Estimate" });
  for (const name of ["Flag", "Fixed"]) {
    const required = screen.getByRole("switch", { name: `${name} ${label("required")}` });
    expect(required.getAttribute("aria-disabled")).toBe("true");
    clickControl(required);
  }
  expect(service.save).not.toHaveBeenCalled();
  clickControl(screen.getByRole("switch", { name: `Estimate ${label("required")}` }));
  await waitFor(() =>
    expect(service.save).toHaveBeenCalledWith("workspace", "project", { is_required: true }, "estimate")
  );
  await waitFor(() => expect(service.list).toHaveBeenCalledTimes(2));
});

it("retains a failed creation draft with inline server errors and retries with a trimmed payload", async () => {
  service.save
    .mockRejectedValueOnce({ response: { data: { name: ["A property with this name already exists."] } } })
    .mockResolvedValue(property({ id: "created" }));
  setup();
  await newProperty();
  await chooseType("text");
  fireEvent.change(screen.getByRole("textbox", { name: label("name_label") }), {
    target: { value: "  Customer code  " },
  });
  fireEvent.click(screen.getByRole("button", { name: label("add_description") }));
  fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "External reference" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  clickControl(screen.getByRole("switch", { name: label("required") }));
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  expect(await screen.findByText(label("invalid_name"))).toBeTruthy();
  expect(screen.getByRole("textbox", { name: label("name_label") }).getAttribute("aria-invalid")).toBe("true");
  expect(toast).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe(
    "  Customer code  "
  );
  expect((screen.getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe(
    "External reference"
  );
  expect(screen.getByRole("switch", { name: label("required") }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(service.save).toHaveBeenCalledTimes(2));
  expect(service.save).toHaveBeenLastCalledWith(
    "workspace",
    "project",
    {
      name: "Customer code",
      description: "External reference",
      property_type: "text",
      config: {},
      is_active: true,
      is_required: true,
      type_id: undefined,
    },
    undefined
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("atomically creates dropdown options with client IDs and blocks blank options inline", async () => {
  setup("bug");
  const dialog = await newProperty("bug");
  const nameInput = within(dialog).getByRole("textbox", { name: label("name_label") });
  expect(nameInput.getAttribute("placeholder")).toBe(label("name_placeholder"));
  fireEvent.change(nameInput, { target: { value: "  Priority  " } });
  await chooseType("dropdown");
  for (const name of ["  Low  ", "   ", "High"]) {
    fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
    const inputs = screen.getAllByRole("textbox", { name: new RegExp(label("option_name")) });
    fireEvent.change(inputs[inputs.length - 1], { target: { value: name } });
  }
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  expect(service.save).not.toHaveBeenCalled();
  expect(within(dialog).getByText(label("option_required"))).toBeTruthy();
  const inputs = within(dialog).getAllByRole("textbox", { name: new RegExp(label("option_name")) });
  expect((inputs[0] as HTMLInputElement).value).toBe("  Low  ");
  expect((inputs[2] as HTMLInputElement).value).toBe("High");
  fireEvent.change(inputs[1], { target: { value: "  Medium  " } });
  fireEvent.click(screen.getByRole("combobox", { name: label("default_value") }));
  const highOption = await screen.findByRole("option", { name: "High" });
  fireEvent.pointerDown(highOption, { pointerType: "mouse" });
  fireEvent.click(highOption);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
  const payload = service.save.mock.calls[0][2];
  expect(service.save).toHaveBeenCalledWith(
    "workspace",
    "project",
    {
      name: "Priority",
      description: "",
      property_type: "dropdown",
      config: { default_value: payload.options[2].client_id },
      is_active: true,
      is_required: false,
      type_id: "bug",
      options: ["Low", "Medium", "High"].map((name, sort_order) => ({
        client_id: expect.any(String),
        name,
        sort_order,
        color: undefined,
        is_active: undefined,
      })),
    },
    undefined
  );
  expect(payload).not.toHaveProperty("options_version");
  expect(new Set(payload.options.map((option: { client_id: string }) => option.client_id)).size).toBe(3);
  expect(payload.options.every((option: { client_id: string }) => option.client_id.length > 0)).toBe(true);
  expect(service.bindType).not.toHaveBeenCalled();
  expect(service.saveOption).not.toHaveBeenCalled();
  expect(service.removeOption).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("starts optional sections collapsed and expands a saved description when editing", async () => {
  setup();
  let dialog = await newProperty();
  for (const key of ["add_description", "more_settings"]) {
    expect(
      within(dialog)
        .getByRole("button", { name: new RegExp(label(key)) })
        .getAttribute("aria-expanded")
    ).toBe("false");
  }
  fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Estimate" }));
  dialog = await screen.findByRole("dialog");
  expect(
    within(dialog)
      .getByRole("button", { name: /^description/ })
      .getAttribute("aria-expanded")
  ).toBe("true");
  expect((within(dialog).getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe(
    "Planning effort"
  );
  expect(
    within(dialog)
      .getByRole("button", { name: new RegExp(label("more_settings")) })
      .getAttribute("aria-expanded")
  ).toBe("false");
  fireEvent.click(within(dialog).getByRole("button", { name: /^description/ }));
  expect(
    within(dialog)
      .getByRole("button", { name: /^description/ })
      .getAttribute("aria-expanded")
  ).toBe("false");
  await waitFor(() => expect(within(dialog).queryByRole("textbox", { name: "description" })).toBeNull());
  fireEvent.click(within(dialog).getByRole("button", { name: /^description/ }));
  expect((within(dialog).getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe(
    "Planning effort"
  );
});

it("atomically creates and binds a field through type_id and refreshes both lists", async () => {
  setup("bug");
  await newProperty("bug");
  await chooseType("text");
  fireEvent.change(screen.getByRole("textbox", { name: label("name_label") }), { target: { value: "Severity" } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label("more_settings")) }));
  clickControl(screen.getByRole("switch", { name: label("required") }));
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(service.save).toHaveBeenCalledWith(
      "workspace",
      "project",
      {
        name: "Severity",
        description: "",
        property_type: "text",
        config: {},
        is_active: true,
        is_required: true,
        type_id: "bug",
      },
      undefined
    )
  );
  expect(service.bindType).not.toHaveBeenCalled();
  await waitFor(() => expect(service.list).toHaveBeenCalledTimes(4));
  expect(service.list).toHaveBeenCalledWith("workspace", "project", "bug");
  expect(service.list).toHaveBeenCalledWith("workspace", "project");
});

it("updates effective type flags without changing the global property", async () => {
  service.list.mockResolvedValue(
    response([
      property({
        is_active: false,
        is_required: true,
        effective_is_active: true,
        effective_is_required: false,
        type_settings: [{ type_id: "bug", project_issue_type_id: "project-bug", is_active: true, is_required: false }],
      }),
    ])
  );
  setup("bug");
  const active = await screen.findByRole("switch", { name: `Estimate ${label("active")}` });
  expect(active.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("switch", { name: `Estimate ${label("required")}` }).getAttribute("aria-checked")).toBe(
    "false"
  );
  clickControl(active);
  await waitFor(() =>
    expect(service.bindType).toHaveBeenCalledWith("workspace", "project", "bug", "estimate", {
      is_active: false,
      is_required: false,
    })
  );
  expect(service.save).not.toHaveBeenCalled();
});

it("offers only fields without an active binding and binds just the selected existing field", async () => {
  const bound = property({
    id: "bound",
    name: "Bound",
    type_settings: [{ type_id: "bug", project_issue_type_id: "project-bug", is_active: true, is_required: false }],
  });
  const inactive = property({
    id: "inactive",
    name: "Inactive binding",
    type_settings: [{ type_id: "bug", project_issue_type_id: "project-bug", is_active: false, is_required: true }],
  });
  service.list.mockImplementation((_slug: string, _project: string, typeId?: string) =>
    Promise.resolve(response(typeId ? [bound] : [bound, inactive, property()]))
  );
  setup("bug");
  fireEvent.click(await screen.findByRole("button", { name: label("add_property") }));
  fireEvent.click(await screen.findByRole("menuitem", { name: label("add_existing") }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByRole("checkbox", { name: "Bound" })).toBeNull();
  expect((within(dialog).getByRole("button", { name: "add" }) as HTMLButtonElement).disabled).toBe(true);
  clickControl(within(dialog).getByRole("checkbox", { name: "Inactive binding" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "add" }));
  await waitFor(() =>
    expect(service.bindType).toHaveBeenCalledWith("workspace", "project", "bug", "inactive", {
      is_active: true,
      is_required: false,
    })
  );
  expect(service.bindType).toHaveBeenCalledTimes(1);
  expect(service.save).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("requires deactivation before deletion and confirmation before calling remove", async () => {
  let active = true;
  service.list.mockImplementation(() => Promise.resolve(response([property({ is_active: active })])));
  service.save.mockImplementation(async () => {
    active = false;
    return property({ is_active: false });
  });
  setup();
  await menu();
  const disabledDelete = screen.getByRole("menuitem", { name: "delete" });
  expect(disabledDelete.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(disabledDelete);
  expect(service.remove).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  clickControl(screen.getByRole("switch", { name: `Estimate ${label("active")}` }));
  await waitFor(() => expect(service.list).toHaveBeenCalledTimes(2));
  await menu();
  fireEvent.click(screen.getByRole("menuitem", { name: "delete" }));
  const dialog = await screen.findByRole("dialog");
  expect(service.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(service.remove).toHaveBeenCalledWith("workspace", "project", "estimate"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("shows explicit inactive type bindings but excludes unbound and other-type properties", async () => {
  service.list.mockResolvedValue(
    response([
      property({
        id: "inactive",
        name: "Inactive",
        effective_is_active: false,
        type_settings: [{ type_id: "bug", project_issue_type_id: "project-bug", is_active: false, is_required: false }],
      }),
      property({
        id: "other",
        name: "Other type",
        type_settings: [
          { type_id: "task", project_issue_type_id: "project-task", is_active: true, is_required: false },
        ],
      }),
      property(),
    ])
  );
  setup("bug");
  await screen.findByRole("button", { name: "Inactive" });
  expect(screen.queryByRole("button", { name: "Estimate" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Other type" })).toBeNull();
  const active = screen.getByRole("switch", { name: `Inactive ${label("active")}` });
  expect(active.getAttribute("aria-checked")).toBe("false");
  clickControl(active);
  await waitFor(() =>
    expect(service.bindType).toHaveBeenCalledWith("workspace", "project", "bug", "inactive", {
      is_active: true,
      is_required: false,
    })
  );
});

it.each(["name", "options"])(
  "edits dropdown metadata and options atomically through the %s entry and retains failed input",
  async (entry) => {
    service.list.mockResolvedValue(
      response([
        property({
          property_type: "dropdown",
          options: [
            { id: "low", name: "Low", color: "#fff", sort_order: 0, is_active: true },
            { id: "high", name: "High", color: "#000", sort_order: 1, is_active: true },
            { id: "archived", name: "Archived", color: "#999", sort_order: 2, is_active: false, is_archived: true },
          ],
        }),
      ])
    );
    service.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(property());
    setup();
    if (entry === "options") {
      await menu();
      fireEvent.click(screen.getByRole("menuitem", { name: label("options") }));
    } else fireEvent.click(await screen.findByRole("button", { name: "Estimate" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: label("edit_property") })).toBeTruthy();
    expect((within(dialog).getByRole("combobox", { name: label("property_type") }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(within(dialog).getAllByRole("textbox", { name: new RegExp(label("option_name")) })).toHaveLength(2);
    fireEvent.change(within(dialog).getByRole("textbox", { name: label("name_label") }), {
      target: { value: "  Renamed  " },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: `${label("option_name")} 1` }), {
      target: { value: "  Lower  " },
    });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "remove" })[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: label("add_option") }));
    fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
    expect(service.save).not.toHaveBeenCalled();
    expect(within(dialog).getByText(label("option_required"))).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: `${label("option_name")} 2` }), {
      target: { value: "New" },
    });
    fireEvent.click(within(dialog).getByRole("combobox", { name: label("default_value") }));
    const option = await screen.findByRole("option", { name: "New" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
    expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", label("save_failed"));
    expect(toast).not.toHaveBeenCalled();
    expect((within(dialog).getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe(
      "  Renamed  "
    );
    expect((within(dialog).getByRole("textbox", { name: `${label("option_name")} 1` }) as HTMLInputElement).value).toBe(
      "  Lower  "
    );
    expect((within(dialog).getByRole("textbox", { name: `${label("option_name")} 2` }) as HTMLInputElement).value).toBe(
      "New"
    );
    const firstPayload = service.save.mock.calls[0][2];
    expect(service.save).toHaveBeenCalledWith(
      "workspace",
      "project",
      {
        name: "Renamed",
        description: "Planning effort",
        property_type: "dropdown",
        config: { default_value: firstPayload.options[1].client_id },
        options_version: "v1",
        is_active: true,
        is_required: false,
        options: [
          { id: "low", name: "Lower", color: "#fff", sort_order: 0, is_active: true },
          { client_id: expect.any(String), name: "New", color: undefined, sort_order: 1, is_active: undefined },
        ],
      },
      "estimate"
    );
    expect(firstPayload).not.toHaveProperty("type_id");
    expect(firstPayload.options[1].client_id).not.toBe("");
    fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(service.save).toHaveBeenCalledTimes(2);
    expect(service.save).toHaveBeenLastCalledWith("workspace", "project", firstPayload, "estimate");
    expect(service.saveOption).not.toHaveBeenCalled();
    expect(service.removeOption).not.toHaveBeenCalled();
  }
);

it("retains a conflicting dropdown draft inline without automatically retrying or overwriting newer options", async () => {
  service.list.mockResolvedValue(
    response([
      property({
        property_type: "dropdown",
        config: { default_value: "low" },
        options: [{ id: "low", name: "Low", color: "#fff", sort_order: 0, is_active: true }],
      }),
    ])
  );
  service.save.mockRejectedValue({ response: { status: 409, data: { code: "CUSTOM_PROPERTY_OPTIONS_CONFLICT" } } });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Estimate" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: label("name_label") }), {
    target: { value: "My draft" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: `${label("option_name")} 1` }), {
    target: { value: "My option" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: label("add_option") }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: `${label("option_name")} 2` }), {
    target: { value: "New option" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
  expect((await within(dialog).findByText(label("options_conflict"))).getAttribute("role")).toBe("alert");
  await waitFor(() =>
    expect((within(dialog).getByRole("button", { name: "save" }) as HTMLButtonElement).disabled).toBe(false)
  );
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect((within(dialog).getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe(
    "My draft"
  );
  expect((within(dialog).getByRole("textbox", { name: `${label("option_name")} 1` }) as HTMLInputElement).value).toBe(
    "My option"
  );
  expect((within(dialog).getByRole("textbox", { name: `${label("option_name")} 2` }) as HTMLInputElement).value).toBe(
    "New option"
  );
  expect(service.save).toHaveBeenCalledTimes(1);
  expect(service.save).toHaveBeenCalledWith(
    "workspace",
    "project",
    {
      name: "My draft",
      description: "Planning effort",
      property_type: "dropdown",
      config: { default_value: "low" },
      options_version: "v1",
      is_active: true,
      is_required: false,
      options: [
        { id: "low", name: "My option", color: "#fff", sort_order: 0, is_active: true },
        { client_id: expect.any(String), name: "New option", color: undefined, sort_order: 1, is_active: undefined },
      ],
    },
    "estimate"
  );
  expect(service.list).toHaveBeenCalledTimes(1);
  expect(service.saveOption).not.toHaveBeenCalled();
  expect(service.removeOption).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

it("retains deletion confirmation on failure so the same field can be retried", async () => {
  service.list.mockResolvedValue(response([property({ is_active: false })]));
  service.remove.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  setup();
  await menu();
  fireEvent.click(screen.getByRole("menuitem", { name: "delete" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(toast).toHaveBeenCalled());
  expect(screen.getByRole("dialog")).toBe(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(service.remove).toHaveBeenCalledTimes(2));
  expect(service.remove).toHaveBeenLastCalledWith("workspace", "project", "estimate");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each(["existing", "options"])(
  "retains the %s dialog and its content until the exit animation finishes",
  async (kind) => {
    let finishAnimation!: () => void;
    const finished = new Promise<void>((resolve) => {
      finishAnimation = resolve;
    });
    const previousAnimations = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations");
    Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [{ finished }] });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    try {
      service.list.mockResolvedValue(
        response([
          property({
            property_type: "dropdown",
            options: [{ id: "low", name: "Low", color: "#fff", sort_order: 0, is_active: true }],
          }),
        ])
      );
      setup(kind === "existing" ? "bug" : undefined);
      if (kind === "existing") {
        fireEvent.click(await screen.findByRole("button", { name: label("add_property") }));
        fireEvent.click(await screen.findByRole("menuitem", { name: label("add_existing") }));
      } else {
        await menu();
        fireEvent.click(screen.getByRole("menuitem", { name: label("options") }));
      }
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
      if (kind === "existing") clickControl(within(dialog).getByRole("checkbox", { name: "Estimate" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
      expect(dialog.isConnected).toBe(true);
      expect(dialog.hasAttribute("data-ending-style")).toBe(true);
      if (kind === "existing")
        expect(within(dialog).getByRole("checkbox", { name: "Estimate" }).getAttribute("aria-checked")).toBe("true");
      else
        expect(
          (within(dialog).getByRole("textbox", { name: `${label("option_name")} 1` }) as HTMLInputElement).value
        ).toBe("Low");
      await act(async () => finishAnimation());
      await waitFor(() => expect(dialog.isConnected).toBe(false));
      if (kind === "existing") {
        fireEvent.click(screen.getByRole("button", { name: label("add_property") }));
        fireEvent.click(await screen.findByRole("menuitem", { name: label("add_existing") }));
        const reopened = await screen.findByRole("dialog");
        expect(within(reopened).getByRole("checkbox", { name: "Estimate" }).getAttribute("aria-checked")).toBe("false");
      }
    } finally {
      if (previousAnimations) Object.defineProperty(HTMLElement.prototype, "getAnimations", previousAnimations);
      else delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
      vi.unstubAllGlobals();
    }
  }
);

it("notifies the parent after successful mutation and list refresh, but not after a failed mutation", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  service.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(property());
  setup(undefined, onChanged);
  const active = await screen.findByRole("switch", { name: `Estimate ${label("active")}` });
  clickControl(active);
  await waitFor(() => expect(toast).toHaveBeenCalled());
  expect(onChanged).not.toHaveBeenCalled();
  clickControl(active);
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(service.list).toHaveBeenCalledTimes(2);
  expect(service.list.mock.invocationCallOrder[1]).toBeLessThan(onChanged.mock.invocationCallOrder[0]);
});

it("closes a successfully saved draft even if refreshing parent counts fails", async () => {
  const onChanged = vi.fn().mockRejectedValue(new Error("counts offline"));
  setup(undefined, onChanged);
  await newProperty();
  await chooseType("text");
  fireEvent.change(screen.getByRole("textbox", { name: label("name_label") }), { target: { value: "Customer code" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(service.save).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({ type: "error", title: "error", message: label("load_failed") });
  expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ message: label("save_failed") }));
  await newProperty();
  expect((screen.getByRole("textbox", { name: label("name_label") }) as HTMLInputElement).value).toBe("");
  expect(service.save).toHaveBeenCalledTimes(1);
});

async function submitMerge() {
  await screen.findByRole("button", { name: "Estimate" });
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.common.more_actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: label("merge.title") }));
  await chooseType("text");
  fireEvent.click(screen.getByRole("button", { name: label("merge.continue") }));
  clickControl(screen.getByRole("checkbox", { name: "Estimate" }));
  clickControl(screen.getByRole("checkbox", { name: "Other" }));
  fireEvent.click(screen.getByRole("button", { name: label("merge.continue") }));
  await screen.findByRole("textbox", { name: label("title") });
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "Merged" } });
  fireEvent.change(screen.getByRole("textbox", { name: label("merge.confirmation") }), {
    target: { value: label("merge.confirmation_word") },
  });
  fireEvent.click(screen.getByRole("button", { name: label("merge.action") }));
}

it("closes a successful merge when definitions refresh rejects and never offers to submit it again", async () => {
  service.list
    .mockResolvedValueOnce(response([property(), property({ id: "other", name: "Other" })]))
    .mockRejectedValue(new Error("refresh offline"));
  service.previewMerge.mockResolvedValue({ work_items_count: 2, draft_count: 0, type_count: 2 });
  service.merge.mockResolvedValue({ property: property({ id: "merged" }), merged_count: 2 });
  const onChanged = vi.fn().mockResolvedValue(undefined);
  setup(undefined, onChanged);
  await submitMerge();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(service.merge).toHaveBeenCalledTimes(1);
  expect(onChanged).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({ type: "error", title: "error", message: label("load_failed") });
  expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ message: label("save_failed") }));
  expect(screen.queryByRole("button", { name: label("merge.action") })).toBeNull();
});

it("invalidates every type definition cache in the merged project without touching other projects", async () => {
  service.list.mockResolvedValue(response([property(), property({ id: "other", name: "Other" })]));
  service.previewMerge.mockResolvedValue({ work_items_count: 2, draft_count: 0, type_count: 2 });
  service.merge.mockResolvedValue({ property: property({ id: "merged" }), merged_count: 2 });
  const fetchDefinition = vi.fn().mockResolvedValue({ version: "before" });
  function DefinitionProbe({ projectId, typeId }: { projectId: string; typeId: string }) {
    useSWR(["custom-properties", "workspace", projectId, typeId], () => fetchDefinition(projectId, typeId));
    return null;
  }
  render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}
    >
      <WorkItemPropertiesSettings workspaceSlug="workspace" projectId="project" types={[]} />
      <DefinitionProbe projectId="project" typeId="bug" />
      <DefinitionProbe projectId="project" typeId="task" />
      <DefinitionProbe projectId="another-project" typeId="bug" />
    </SWRConfig>
  );
  await waitFor(() => expect(fetchDefinition).toHaveBeenCalledTimes(3));
  await submitMerge();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetchDefinition.mock.calls.filter(([projectId]) => projectId === "project")).toHaveLength(4);
  expect(fetchDefinition.mock.calls.filter(([projectId]) => projectId === "another-project")).toHaveLength(1);
});

it("disables mutations while saving and does not submit a second request", async () => {
  let resolveSave!: (value: TCustomProperty) => void;
  service.save.mockReturnValue(
    new Promise<TCustomProperty>((resolve) => {
      resolveSave = resolve;
    })
  );
  setup();
  const active = await screen.findByRole("switch", { name: `Estimate ${label("active")}` });
  clickControl(active);
  const required = screen.getByRole("switch", { name: `Estimate ${label("required")}` });
  expect(required.getAttribute("aria-disabled")).toBe("true");
  clickControl(required);
  expect(service.save).toHaveBeenCalledTimes(1);
  await act(async () => resolveSave(property()));
  await waitFor(() => expect(required.getAttribute("aria-disabled")).not.toBe("true"));
});
