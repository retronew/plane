import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TProjectIssueType } from "@plane/types";
import { IssueTypesSettings } from "./issue-types-settings";
import { filterIssueTypes, groupIssueTypeLevels } from "./types-settings-utils";

const fixtures: TProjectIssueType[] = [
  {
    id: "task",
    project_issue_type_id: "pt",
    name: "Task",
    is_default: true,
    is_active: true,
    workflow_id: null,
    level: 0,
    properties_count: 3,
  },
  {
    id: "bug",
    project_issue_type_id: "pb",
    name: "Bug",
    description: "Defect",
    is_default: false,
    is_active: false,
    workflow_id: null,
    level: 0,
  },
  {
    id: "epic",
    project_issue_type_id: "pe",
    name: "Epic",
    is_default: false,
    is_active: true,
    workflow_id: null,
    is_epic: true,
  },
];
const state = vi.hoisted(() => ({
  typeId: undefined as string | undefined,
  params: new URLSearchParams(),
  properties: vi.fn(),
  navigate: vi.fn(),
  store: {
    issueTypes: {} as Record<string, { results: TProjectIssueType[]; policy_version: number; can_manage: boolean }>,
    lists: { p: { results: [] } },
    fetchTypes: vi.fn(),
    fetchList: vi.fn(),
    refresh: vi.fn(),
    service: { saveType: vi.fn(), preview: vi.fn() },
  },
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w", projectId: "p", typeId: state.typeId }),
  useNavigate: () => state.navigate,
  useSearchParams: () => [
    state.params,
    (callback: (previous: URLSearchParams) => URLSearchParams) => {
      state.params = callback(state.params);
    },
  ],
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => <span>logo</span>, EmojiPicker: () => null }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issueMap: {} }) }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/settings/page-header", () => ({ SettingsPageHeader: () => null }));
vi.mock("./impact-dialog", () => ({ WorkflowImpactDialog: () => null }));
vi.mock("./types-properties-settings", () => ({
  WorkItemPropertiesSettings: (props: unknown) => {
    state.properties(props);
    return <div>properties interface</div>;
  },
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: () => null,
  MenuItem: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@plane/blocks/common", () => ({
  ActionMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
beforeEach(() => {
  state.typeId = undefined;
  state.params = new URLSearchParams();
  state.properties.mockClear();
  state.store.issueTypes = { p: { results: fixtures, policy_version: 2, can_manage: true } };
  state.store.fetchTypes.mockReset().mockResolvedValue({});
  state.store.fetchList.mockReset().mockResolvedValue({});
  state.store.refresh.mockReset().mockResolvedValue({});
  state.store.service.saveType.mockReset().mockResolvedValue(fixtures[1]);
});
it("filters status, searches description, sorts both directions without mutating store order", () => {
  expect(filterIssueTypes(fixtures, " defect ", "inactive", false).map((type) => type.id)).toEqual(["bug"]);
  expect(filterIssueTypes(fixtures, "", "active", true).map((type) => type.id)).toEqual(["task", "epic"]);
  expect(fixtures.map((type) => type.id)).toEqual(["task", "bug", "epic"]);
});
it("uses explicit levels and epic fallback for descending read-only hierarchy", () => {
  expect(groupIssueTypeLevels(fixtures).map(([level, items]) => [level, items.map((type) => type.id)])).toEqual([
    [1, ["epic"]],
    [0, ["task", "bug"]],
  ]);
  expect(groupIssueTypeLevels([{ ...fixtures[2], level: 2 }])[0][0]).toBe(2);
});
it("renders table columns, real property counts and detail URLs", () => {
  render(<IssueTypesSettings />);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "web.workflow_ui.types_settings.property_count" })).toBeTruthy();
  expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  expect(screen.getByRole("row", { name: /Task/ }).querySelector("td:last-child span")?.textContent).toBe("3");
  expect(screen.getByRole("link", { name: /Task/ }).getAttribute("href")).toBe(
    "/w/settings/projects/p/work-item-types/types/task/properties/"
  );
  const deletions = screen.getAllByRole("button", { name: "delete" });
  expect(deletions.filter((button) => (button as HTMLButtonElement).disabled)).toHaveLength(1);
  expect(
    screen.getByRole("row", { name: /Task/ }).querySelector<HTMLButtonElement>("button:last-of-type")?.disabled
  ).toBe(true);
});
it("sorts through two menu choices with a stable sort trigger", () => {
  render(<IssueTypesSettings />);
  const rowNames = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("a")?.textContent);
  expect(rowNames()[0]).toContain("Bug");
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.sort_name_desc" }));
  expect(rowNames()[0]).toContain("Task");
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.sort_name" }));
  expect(rowNames()[0]).toContain("Bug");
});
it("uses service for enabling a type and refreshes the store", async () => {
  render(<IssueTypesSettings />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.enable_one" }));
  await waitFor(() =>
    expect(state.store.service.saveType).toHaveBeenCalledWith("w", "p", { is_active: true, version: 2 }, "bug")
  );
  expect(state.store.refresh).toHaveBeenCalledWith("w", "p");
});
it("replaces the detail URL when saving creates a project-specific type id", async () => {
  state.typeId = "bug";
  state.navigate.mockClear();
  state.store.service.saveType.mockResolvedValueOnce({ ...fixtures[1], id: "project-bug" });
  render(<IssueTypesSettings />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.enable_one" }));
  await waitFor(() =>
    expect(state.navigate).toHaveBeenCalledWith(
      "/w/settings/projects/p/work-item-types/types/project-bug/properties/",
      { replace: true }
    )
  );
});
it("passes the selected type id and refreshes property counts when the properties integration changes", async () => {
  state.typeId = "task";
  render(<IssueTypesSettings />);
  expect(state.properties).toHaveBeenCalledWith({
    projectId: "p",
    workspaceSlug: "w",
    types: fixtures,
    typeId: "task",
    onChanged: expect.any(Function),
  });
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  state.store.fetchTypes.mockClear();
  const props = state.properties.mock.calls.at(-1)?.[0] as { onChanged: () => Promise<unknown> };
  await props.onChanged();
  expect(state.store.fetchTypes).toHaveBeenCalledExactlyOnceWith("w", "p");
});
it("reads property tab from the query and writes hierarchy tab to the query", () => {
  state.params = new URLSearchParams("tab=properties");
  render(<IssueTypesSettings />);
  expect(screen.getByText("properties interface")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "web.workflow_ui.types_settings.hierarchy" }));
  expect(state.params.get("tab")).toBe("hierarchy");
});
it("shows a retry action after load failure and reloads through the store", async () => {
  state.store.fetchTypes.mockRejectedValueOnce(new Error("offline"));
  render(<IssueTypesSettings />);
  const retry = await screen.findByRole("button", { name: "web.retry" });
  fireEvent.click(retry);
  await waitFor(() => expect(state.store.refresh).toHaveBeenCalledWith("w", "p"));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
