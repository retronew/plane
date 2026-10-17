import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
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
  const option = await screen.findByRole("option", { name: label(`types.${type}`) });
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

it("retains a failed creation draft and retries with a trimmed payload", async () => {
  service.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(property({ id: "created" }));
  setup();
  await newProperty();
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "  Customer code  " } });
  fireEvent.change(screen.getByRole("textbox", { name: "description" }), { target: { value: "External reference" } });
  clickControl(screen.getByRole("checkbox", { name: label("required") }));
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith({ type: "error", title: "error", message: label("save_failed") })
  );
  expect((screen.getByRole("textbox", { name: label("title") }) as HTMLInputElement).value).toBe("  Customer code  ");
  expect((screen.getByRole("textbox", { name: "description" }) as HTMLTextAreaElement).value).toBe(
    "External reference"
  );
  expect(screen.getByRole("checkbox", { name: label("required") }).getAttribute("aria-checked")).toBe("true");
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
      options: undefined,
    },
    undefined
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("creates initial dropdown options with blank names excluded and names trimmed", async () => {
  setup();
  await newProperty();
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "Priority" } });
  await chooseType("dropdown");
  for (const name of ["  Low  ", "   ", "High"]) {
    fireEvent.click(screen.getByRole("button", { name: label("add_option") }));
    const inputs = screen.getAllByRole("textbox", { name: new RegExp(label("option_name")) });
    fireEvent.change(inputs[inputs.length - 1], { target: { value: name } });
  }
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() =>
    expect(service.save).toHaveBeenCalledWith(
      "workspace",
      "project",
      {
        name: "Priority",
        description: "",
        property_type: "dropdown",
        config: {},
        is_active: true,
        is_required: false,
        type_id: undefined,
        options: [
          { name: "Low", sort_order: 0 },
          { name: "High", sort_order: 2 },
        ],
      },
      undefined
    )
  );
});

it("atomically creates and binds a field through type_id and refreshes both lists", async () => {
  setup("bug");
  await newProperty("bug");
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "Severity" } });
  clickControl(screen.getByRole("checkbox", { name: label("required") }));
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
        options: undefined,
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

it("does not replace persisted dropdown options when editing metadata", async () => {
  service.list.mockResolvedValue(
    response([
      property({
        property_type: "dropdown",
        options: [{ id: "low", name: "Low", color: "#fff", sort_order: 0, is_active: true }],
      }),
    ])
  );
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Estimate" }));
  await screen.findByRole("dialog");
  expect((screen.getByRole("combobox", { name: label("property_type") }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: label("add_option") })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "Renamed" } });
  fireEvent.click(screen.getByRole("combobox", { name: label("default_value") }));
  const option = await screen.findByRole("option", { name: "Low" });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
  expect(service.save.mock.calls[0][2]).toEqual({
    name: "Renamed",
    description: "Planning effort",
    property_type: "dropdown",
    config: { default_value: "low" },
    is_active: true,
    is_required: false,
  });
  expect(service.save.mock.calls[0][2]).not.toHaveProperty("options");
  expect(service.save.mock.calls[0][2]).not.toHaveProperty("type_id");
  expect(service.save.mock.calls[0][3]).toBe("estimate");
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
      fireEvent.click(within(dialog).getByRole("button", { name: kind === "existing" ? "cancel" : "close" }));
      expect(dialog.isConnected).toBe(true);
      expect(dialog.hasAttribute("data-ending-style")).toBe(true);
      if (kind === "existing")
        expect(within(dialog).getByRole("checkbox", { name: "Estimate" }).getAttribute("aria-checked")).toBe("true");
      else expect(within(dialog).getByRole("button", { name: "Low" })).toBeTruthy();
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
  fireEvent.change(screen.getByRole("textbox", { name: label("title") }), { target: { value: "Customer code" } });
  fireEvent.click(screen.getByRole("button", { name: label("create") }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(service.save).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({ type: "error", title: "error", message: label("load_failed") });
  expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ message: label("save_failed") }));
  await newProperty();
  expect((screen.getByRole("textbox", { name: label("title") }) as HTMLInputElement).value).toBe("");
  expect(service.save).toHaveBeenCalledTimes(1);
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
