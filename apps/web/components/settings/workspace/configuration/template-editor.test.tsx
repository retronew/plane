import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplateEditor } from "./template-editor";

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  mutate: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  projectTemplate: false,
}));
vi.mock("react-router", () => ({
  useParams: () => ({
    workspaceSlug: "w",
    templateKind: mocks.projectTemplate ? "project" : "work-item",
    templateId: "t",
  }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "w" }) }) }));
vi.mock("@/components/editor/rich-text", () => ({ RichTextEditor: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/settings/page-header", () => ({ SettingsPageHeader: () => null }));
vi.mock("@/components/settings/heading", () => ({ SettingsHeading: () => null }));
vi.mock("./category-color-picker", () => ({ CategoryColorPicker: () => null }));
vi.mock("./select", () => ({ ConfigurationSelect: () => null }));
vi.mock("@makeplane/propel/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <input
      role="switch"
      aria-checked={checked}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));
vi.mock("@makeplane/propel/components/checkbox", () => ({
  Checkbox: ({
    label,
    checked,
    onCheckedChange,
  }: {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <label>
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
    </label>
  ),
}));
vi.mock("@/services/workspace-configuration.service", () => ({
  configurationKey: () => "templates",
  projectConfigurationKey: () => "project",
  workspaceConfigurationService: { save: mocks.save },
}));
vi.mock("swr", () => {
  const existing = {
    id: "t",
    kind: "work_item",
    name: "Template",
    title: "",
    short_description: "",
    description_html: "<p></p>",
    priority: "none",
    project: "p",
    configuration: { label_ids: ["unknown", "b", "b"], module_ids: ["a"] },
  };
  const options = {
    labels: [
      { id: "a", name: "Label A" },
      { id: "b", name: "Label B" },
    ],
    modules: [
      { id: "a", name: "Module A" },
      { id: "b", name: "Module B" },
    ],
  };
  const project = {
    ...existing,
    kind: "project",
    project: null,
    is_default_state_template: false,
    configuration: { states: [{ name: "Ready", group: "unstarted", color: "#123456", default: true }] },
  };
  return {
    default: (key: string) => ({
      data: key.startsWith("template-options:") ? options : mocks.projectTemplate ? project : existing,
    }),
    useSWRConfig: () => ({ mutate: mocks.mutate }),
  };
});
it("persists independent default-template and creation switches, including legacy true", async () => {
  mocks.projectTemplate = true;
  mocks.save.mockClear();
  const { container, unmount } = render(<TemplateEditor />);
  const templateSwitch = screen.getByLabelText("web.default_state_template");
  const creationSwitch = screen.getByLabelText("web.allow_new_work_items");
  expect((creationSwitch as HTMLInputElement).checked).toBe(true);
  fireEvent.click(templateSwitch);
  expect((creationSwitch as HTMLInputElement).checked).toBe(true);
  fireEvent.click(creationSwitch);
  expect((templateSwitch as HTMLInputElement).checked).toBe(true);
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  expect(mocks.save.mock.calls[0][2]).toMatchObject({
    is_default_state_template: true,
    configuration: { states: [{ name: "Ready", default: true, allow_new_work_items: false }] },
  });
  unmount();
  mocks.projectTemplate = false;
});

it("keeps fields independent, option order and array update semantics", async () => {
  mocks.save.mockClear();
  const { container } = render(<TemplateEditor />);
  expect(screen.getAllByRole("checkbox", { hidden: true }).map((input) => (input as HTMLInputElement).checked)).toEqual(
    [false, true, true, false]
  );
  fireEvent.click(screen.getByLabelText("Label B"));
  fireEvent.click(screen.getByLabelText("Label A"));
  fireEvent.click(screen.getByLabelText("Module B"));
  expect(screen.getAllByRole("checkbox", { hidden: true }).map((input) => (input as HTMLInputElement).checked)).toEqual(
    [true, false, true, true]
  );
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  expect(mocks.save.mock.calls[0][2].configuration).toMatchObject({
    label_ids: ["unknown", "a"],
    module_ids: ["a", "b"],
  });
});
