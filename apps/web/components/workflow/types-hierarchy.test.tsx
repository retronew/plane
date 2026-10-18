import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TProjectIssueHierarchy } from "@plane/types";
import type { ProjectWorkflowService } from "@/services/project/workflow.service";
import { TypesHierarchy } from "./types-hierarchy";
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { level?: number; name?: string }) =>
      `${key}${values?.level === undefined ? "" : ` ${values.level}`}${values?.name ? ` ${values.name}` : ""}`,
  }),
}));
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("./types-logo", () => ({ TypesLogo: () => null }));
vi.mock("./hierarchy-impact-dialog", () => ({
  HierarchyImpactDialog: ({ request }: { request: unknown }) => (
    <output data-testid="preview">{JSON.stringify(request)}</output>
  ),
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: ({ render: node }: { render: ReactNode }) => node,
  MenuItem: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@plane/blocks/common", () => ({
  ActionMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const config: TProjectIssueHierarchy = {
  enabled: false,
  default_level: 0,
  policy_version: 3,
  can_manage: true,
  levels: [0, 1],
  issue_types: [
    {
      id: "task",
      project_issue_type_id: "pt",
      name: "Task",
      level: 0,
      is_default: true,
      is_active: true,
      workflow_id: null,
    },
    {
      id: "epic",
      project_issue_type_id: "pe",
      name: "Epic",
      level: 1,
      is_default: false,
      is_active: true,
      workflow_id: null,
    },
  ],
};
function setup(canManage = true) {
  render(
    <TypesHierarchy
      config={config}
      base="/types/"
      service={{} as ProjectWorkflowService}
      workspaceSlug="w"
      projectId="p"
      canManage={canManage}
      onApplied={vi.fn()}
    />
  );
}
it("requires explicit enabling and previews the entire type mapping with the selected new-type default", () => {
  setup();
  expect(screen.getByRole("button", { name: "save" }).matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "web.issue_hierarchy.enable" }));
  const level = screen.getByRole("region", { name: "web.issue_hierarchy.level_label 1" });
  fireEvent.click(within(level).getByRole("button", { name: "web.issue_hierarchy.set_default" }));
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(JSON.parse(screen.getByTestId("preview").textContent!)).toEqual({
    enabled: true,
    default_level: 1,
    policy_version: 3,
    type_levels: [
      { type_id: "task", level: 0 },
      { type_id: "epic", level: 1 },
    ],
  });
});
it("moves types to new levels and discards all unsaved settings", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "web.issue_hierarchy.add_level" }));
  expect(screen.getByRole("button", { name: "save" }).matches(":disabled")).toBe(true);
  const task = screen.getByRole("link", { name: "Task" }).parentElement!;
  fireEvent.click(within(task).getByRole("button", { name: "web.issue_hierarchy.move_to 2" }));
  expect(screen.getByRole("button", { name: "save" }).matches(":disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "web.issue_hierarchy.discard" }));
  expect(screen.queryByRole("region", { name: "web.issue_hierarchy.level_label 2" })).toBeNull();
  expect(
    within(screen.getByRole("region", { name: "web.issue_hierarchy.level_label 0" })).getByRole("link", {
      name: "Task",
    })
  ).toBeTruthy();
});
it("keeps scope and type links visible to read-only members without management controls", () => {
  setup(false);
  expect(screen.getByText("web.issue_hierarchy.scope")).toBeTruthy();
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.queryByRole("button")).toBeNull();
});
