import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplateEditor } from "./template-editor";

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  mutate: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w", templateKind: "work-item", templateId: "t" }),
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
  return {
    default: (key: string) => ({ data: key.startsWith("template-options:") ? options : existing }),
    useSWRConfig: () => ({ mutate: mocks.mutate }),
  };
});
it("keeps fields independent, option order and array update semantics", async () => {
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
