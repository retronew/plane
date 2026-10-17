import { useState } from "react";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { TLogoProps } from "@plane/types";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { ProjectTemplateEditor } from "./editor";

const mocks = vi.hoisted(() => ({
  params: {
    workspaceSlug: "w",
    projectId: "p",
    templateKind: "work-item",
    templateId: undefined as string | undefined,
  },
  allowed: true,
  allowPermissions: vi.fn(),
  navigate: vi.fn(),
  detail: vi.fn(),
  save: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: mocks.allowPermissions }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-id" }) }),
}));
vi.mock("@/components/auth-screens/not-authorized-view", () => ({ NotAuthorizedView: () => <p>Not authorized</p> }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children, header }: { children: ReactNode; header: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));
vi.mock("@/components/settings/page-header", () => ({
  SettingsPageHeader: ({ leftItem }: { leftItem: ReactNode }) => <header>{leftItem}</header>,
}));
vi.mock("@/services/workspace-configuration.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/workspace-configuration.service")>()),
  workspaceConfigurationService: { projectTemplate: mocks.detail, saveProjectTemplate: mocks.save },
}));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: ({
    id,
    initialValue,
    onChange,
    editable,
  }: {
    id: string;
    initialValue: string;
    onChange: (json: object, html: string) => void;
    editable: boolean;
  }) => {
    const [value, setValue] = useState(initialValue);
    return (
      <textarea
        aria-label={id}
        disabled={!editable}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onChange({}, event.target.value);
        }}
      />
    );
  },
}));

type SelectProps = {
  value?: string | string[] | null;
  onChange: (value: never) => void;
  disabled?: boolean;
  projectId?: string;
  issueTypeId?: string | null;
};
function Selector({
  label,
  choices,
  value,
  onChange,
  disabled,
  projectId,
  issueTypeId,
}: SelectProps & {
  label: string;
  choices: string[];
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={Array.isArray(value) ? (value[0] ?? "") : (value ?? "")}
      data-project={projectId}
      data-type={issueTypeId ?? ""}
      onChange={(event) => onChange((Array.isArray(value) ? [event.target.value] : event.target.value) as never)}
    >
      <option value="">none</option>
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </select>
  );
}
vi.mock("@/components/dropdowns/project/project-select", () => ({
  ProjectSelect: (props: SelectProps) => <Selector {...props} label="project" choices={["p"]} />,
}));
vi.mock("@/components/dropdowns/issue-type-select", () => ({
  IssueTypeSelect: (props: SelectProps) => <Selector {...props} label="type" choices={["bug", "task"]} />,
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: (props: SelectProps) => <Selector {...props} label="state" choices={["todo", "done"]} />,
}));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: (props: SelectProps) => <Selector {...props} label="priority" choices={["none", "high", "urgent"]} />,
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: (props: SelectProps) => <Selector {...props} label="assignees" choices={["member"]} />,
}));
vi.mock("@/components/dropdowns/label/label-select", () => ({
  LabelSelect: (props: SelectProps) => <Selector {...props} label="labels" choices={["label"]} />,
}));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  Logo: ({ logo }: { logo: TLogoProps }) => <output aria-label="page logo">{JSON.stringify(logo)}</output>,
  EmojiPicker: ({
    label,
    onChange,
    disabled,
  }: {
    label: ReactNode;
    disabled: boolean;
    onChange: (selection: { type: "emoji" | "icon"; value: string | TLogoProps["icon"] }) => void;
  }) => (
    <div>
      {label}
      <button type="button" disabled={disabled} onClick={() => onChange({ type: "emoji", value: "128196" })}>
        Choose emoji
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ type: "icon", value: { name: "File", color: "#123456" } })}
      >
        Choose icon
      </button>
    </div>
  ),
}));

const existing = (kind: WorkspaceTemplate["kind"] = "work_item"): WorkspaceTemplate => ({
  id: "template-id",
  project: "p",
  kind,
  name: "Bug template",
  short_description: "Reproduction steps",
  title: "A bug",
  description_html: "<p>Existing content</p>",
  priority: "high",
  configuration: {
    type_id: "bug",
    state_id: "todo",
    assignee_ids: ["member"],
    label_ids: ["label"],
    children: [
      {
        client_id: "old-id",
        name: "Investigate",
        description_html: "<p>Child body</p>",
        type_id: "task",
        state_id: "done",
        priority: "urgent",
        assignee_ids: ["member"],
        label_ids: ["label"],
      },
    ],
  },
});
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <ProjectTemplateEditor />
    </SWRConfig>
  );
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = { workspaceSlug: "w", projectId: "p", templateKind: "work-item", templateId: undefined };
  mocks.allowed = true;
  mocks.allowPermissions.mockImplementation(() => mocks.allowed);
  mocks.detail.mockResolvedValue(existing());
  mocks.save.mockImplementation(async (_slug, _project, draft) => ({ ...draft, id: draft.id ?? "created" }));
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

it("saves a new project work item template with content and scoped property selections", async () => {
  mount();
  const submit = screen.getByRole("button", { name: "web.create_template_work_item" });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  change("web.template_name", "  Bug report  ");
  change("description", "Summary");
  change("web.template_title", "Report a bug");
  change("template-work-item-description", "<p>Steps to reproduce</p>");
  change("type", "bug");
  change("state", "todo");
  change("priority", "urgent");
  change("assignees", "member");
  change("labels", "label");
  expect(screen.getByLabelText("state").getAttribute("data-type")).toBe("bug");
  expect(screen.getByLabelText("state").getAttribute("data-project")).toBe("p");
  expect((screen.getByLabelText("project") as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(submit);
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({
        kind: "work_item",
        project: "p",
        name: "Bug report",
        short_description: "Summary",
        title: "Report a bug",
        description_html: "<p>Steps to reproduce</p>",
        priority: "urgent",
        configuration: expect.objectContaining({
          type_id: "bug",
          state_id: "todo",
          assignee_ids: ["member"],
          label_ids: ["label"],
        }),
      })
    )
  );
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/w/settings/projects/p/templates/"));
  expect(mocks.detail).not.toHaveBeenCalled();
});

it("roundtrips existing properties and child content when editing only the template name", async () => {
  mocks.params.templateId = "template-id";
  const initial = existing();
  const view = mount();
  await waitFor(() =>
    expect((screen.getByLabelText("web.template_name") as HTMLInputElement).value).toBe(initial.name)
  );
  expect(mocks.detail).toHaveBeenCalledWith("w", "p", "template-id");
  expect((screen.getByLabelText("template-work-item-description") as HTMLTextAreaElement).value).toBe(
    initial.description_html
  );
  expect((screen.getByLabelText("type") as HTMLSelectElement).value).toBe("bug");
  expect((screen.getByLabelText("state") as HTMLSelectElement).value).toBe("todo");
  expect(screen.getByRole("button", { name: "Investigate" })).toBeTruthy();
  change("web.template_name", "Renamed template");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  const saved = mocks.save.mock.calls[0][2] as WorkspaceTemplate;
  expect(saved).toMatchObject({
    ...initial,
    name: "Renamed template",
    configuration: {
      ...initial.configuration,
      children: [expect.objectContaining({ ...initial.configuration.children![0], client_id: expect.any(String) })],
    },
  });
  mocks.detail.mockResolvedValue(saved);
  view.unmount();
  mount();
  await waitFor(() =>
    expect((screen.getByLabelText("web.template_name") as HTMLInputElement).value).toBe("Renamed template")
  );
  expect((screen.getByLabelText("web.template_title") as HTMLInputElement).value).toBe("A bug");
  expect(screen.getByRole("button", { name: "Investigate" })).toBeTruthy();
});

it("clears the previous workflow state when changing the work item type", async () => {
  mocks.params.templateId = "template-id";
  mount();
  await screen.findByRole("button", { name: "Investigate" });
  change("type", "task");
  expect((screen.getByLabelText("state") as HTMLSelectElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({ configuration: expect.objectContaining({ type_id: "task", state_id: null }) })
    )
  );
});

it.each(["emoji", "icon"] as const)("saves page title, body and %s logo without work item fields", async (kind) => {
  mocks.params.templateKind = "page";
  mount();
  fireEvent.change(screen.getByRole("textbox", { name: /^web.template_name/ }), { target: { value: "Page template" } });
  fireEvent.change(screen.getByRole("textbox", { name: /^description/ }), { target: { value: "Page summary" } });
  change("web.template_title", "Meeting notes");
  change("project-template-page", "<p>Agenda</p>");
  fireEvent.click(screen.getByRole("button", { name: `Choose ${kind}` }));
  const logo =
    kind === "emoji"
      ? { in_use: "emoji", emoji: { value: "128196" } }
      : { in_use: "icon", icon: { name: "File", color: "#123456" } };
  expect(JSON.parse(screen.getByLabelText("page logo").textContent!)).toEqual(logo);
  expect(screen.queryByLabelText("type")).toBeNull();
  expect(screen.queryByRole("button", { name: "web.project_template_add_child" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "web.create_template_page" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({
        kind: "page",
        project: "p",
        title: "Meeting notes",
        description_html: "<p>Agenda</p>",
        configuration: expect.objectContaining({ logo_props: logo }),
      })
    )
  );
});

it("preserves an existing page logo when changing the title", async () => {
  mocks.params.templateKind = "page";
  mocks.params.templateId = "template-id";
  const logo: TLogoProps = { in_use: "icon", icon: { name: "File", color: "#123456" } };
  mocks.detail.mockResolvedValue({ ...existing("page"), configuration: { logo_props: logo } });
  mount();
  await screen.findByLabelText("page logo");
  change("web.template_title", "Updated page title");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({
        title: "Updated page title",
        configuration: expect.objectContaining({ logo_props: logo }),
      })
    )
  );
});

it("adds, edits and removes child work items before saving the resulting template", async () => {
  mount();
  change("web.template_name", "Parent template");
  fireEvent.click(screen.getByRole("button", { name: "web.project_template_add_child" }));
  let dialog = await screen.findByRole("dialog", { name: "web.project_template_add_child" });
  fireEvent.change(within(dialog).getByLabelText("web.template_title"), { target: { value: "  Child item  " } });
  fireEvent.change(within(dialog).getByLabelText("template-child-description"), {
    target: { value: "<p>Child steps</p>" },
  });
  fireEvent.change(within(dialog).getByLabelText("type"), { target: { value: "bug" } });
  fireEvent.change(within(dialog).getByLabelText("priority"), { target: { value: "high" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Child item" }));
  dialog = await screen.findByRole("dialog", { name: "web.project_template_edit_child" });
  expect((within(dialog).getByLabelText("template-child-description") as HTMLTextAreaElement).value).toBe(
    "<p>Child steps</p>"
  );
  fireEvent.change(within(dialog).getByLabelText("web.template_title"), { target: { value: "Edited child" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "web.create_template_work_item" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      "w",
      "p",
      expect.objectContaining({
        configuration: expect.objectContaining({
          children: [
            expect.objectContaining({
              name: "Edited child",
              description_html: "<p>Child steps</p>",
              type_id: "bug",
              priority: "high",
            }),
          ],
        }),
      })
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  expect(screen.queryByRole("button", { name: "Edited child" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "web.create_template_work_item" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenLastCalledWith(
      "w",
      "p",
      expect.objectContaining({ configuration: expect.objectContaining({ children: [] }) })
    )
  );
});

it("keeps unsaved fields after a failed save and permits retry", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Network unavailable"));
  mount();
  change("web.template_name", "Unsaved name");
  change("web.template_title", "Unsaved title");
  change("template-work-item-description", "<p>Unsaved body</p>");
  fireEvent.click(screen.getByRole("button", { name: "web.create_template_work_item" }));
  expect((await screen.findByRole("alert")).textContent).toBe("web.configuration_save_error");
  expect((screen.getByLabelText("web.template_name") as HTMLInputElement).value).toBe("Unsaved name");
  expect((screen.getByLabelText("web.template_title") as HTMLInputElement).value).toBe("Unsaved title");
  expect((screen.getByLabelText("template-work-item-description") as HTMLTextAreaElement).value).toBe(
    "<p>Unsaved body</p>"
  );
  expect(mocks.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.create_template_work_item" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/w/settings/projects/p/templates/"));
});

it("blocks detail fetch and the form without project administrator permission", () => {
  mocks.allowed = false;
  mocks.params.templateId = "template-id";
  mount();
  expect(screen.getByText("Not authorized")).toBeTruthy();
  expect(screen.queryByLabelText("web.template_name")).toBeNull();
  expect(mocks.detail).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("rejects unsupported project-template kinds before requesting template details", () => {
  mocks.params.templateKind = "project";
  mocks.params.templateId = "template-id";
  mount();
  expect(screen.getByRole("alert").textContent).toContain("web.configuration_load_error");
  expect(screen.queryByLabelText("web.template_name")).toBeNull();
  expect(mocks.detail).not.toHaveBeenCalled();
});
