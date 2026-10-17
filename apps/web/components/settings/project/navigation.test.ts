import { expect, it } from "vitest";
import { GROUPED_PROJECT_SETTINGS, PROJECT_SETTINGS, PROJECT_SETTINGS_CATEGORY } from "@plane/constants";
import { EUserProjectRoles } from "@plane/types";
import { TemplatesOutline } from "@makeplane/propel/icons";
import { getProjectActivePath } from "../helper";
import { PROJECT_SETTINGS_ICONS } from "./sidebar/item-icon";

it("adds project updates after existing features with an administrator settings route and mobile title", () => {
  const features = GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.FEATURES];
  expect(features.at(-1)).toBe(PROJECT_SETTINGS.project_updates);
  expect(
    Object.values(GROUPED_PROJECT_SETTINGS)
      .flat()
      .filter((item) => item.key === "project_updates")
  ).toHaveLength(1);
  expect(PROJECT_SETTINGS.project_updates.href).toBe("/project-updates");
  expect(PROJECT_SETTINGS.project_updates.access).toEqual([EUserProjectRoles.ADMIN]);
  expect(getProjectActivePath("/w/settings/projects/p/project-updates/")).toBe(
    "web.project_overview.updates_settings_title"
  );
  expect(PROJECT_SETTINGS_ICONS.project_updates).toBeTruthy();
});

it("makes script management a single administrator project setting with a mobile title", () => {
  const entries = Object.values(GROUPED_PROJECT_SETTINGS).flat();
  expect(entries.filter((item) => item.key === "workflow_runner")).toHaveLength(1);
  expect(PROJECT_SETTINGS.workflow_runner.href).toBe("/runner");
  expect(PROJECT_SETTINGS.workflow_runner.access).toEqual([EUserProjectRoles.ADMIN]);
  expect(getProjectActivePath("/w/settings/projects/p/runner/")).toBe("web.workflow_runner.scripts");
});

it("places issue types only in work structure while preserving its route, permissions and active title", () => {
  const entries = Object.values(GROUPED_PROJECT_SETTINGS).flat();
  expect(entries.filter((item) => item.key === "issue_types")).toEqual([PROJECT_SETTINGS.issue_types]);
  expect(GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.WORK_STRUCTURE].map((item) => item.key)).toEqual([
    "states",
    "labels",
    "estimates",
    "issue_types",
    "templates",
  ]);
  expect(GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.EXECUTION]).not.toContain(PROJECT_SETTINGS.issue_types);
  expect(PROJECT_SETTINGS.issue_types.href).toBe("/issue-types");
  expect(PROJECT_SETTINGS.issue_types.access).toEqual([EUserProjectRoles.ADMIN]);
  expect(PROJECT_SETTINGS.issue_types.highlight("/w/settings/projects/p/issue-types/", "/w/settings/projects/p")).toBe(
    true
  );
  expect(getProjectActivePath("/w/settings/projects/p/issue-types/")).toBe("web.workflow_ui.issue_types");
});

it("places administrator templates after issue types and highlights nested editors with the mobile title", () => {
  const entries = Object.values(GROUPED_PROJECT_SETTINGS).flat();
  expect(entries.filter((item) => item.key === "templates")).toEqual([PROJECT_SETTINGS.templates]);
  const workStructure = GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.WORK_STRUCTURE];
  expect(workStructure[workStructure.findIndex((item) => item.key === "issue_types") + 1]).toBe(
    PROJECT_SETTINGS.templates
  );
  expect(PROJECT_SETTINGS.templates.href).toBe("/templates");
  expect(PROJECT_SETTINGS.templates.access).toEqual([EUserProjectRoles.ADMIN]);
  expect(PROJECT_SETTINGS_ICONS.templates).toBe(TemplatesOutline);
  for (const suffix of ["", "work-item/", "page/template-id/"]) {
    const pathname = `/w/settings/projects/p/templates/${suffix}`;
    expect(PROJECT_SETTINGS.templates.highlight(pathname, "/w/settings/projects/p")).toBe(true);
    expect(getProjectActivePath(pathname)).toBe("web.templates");
  }
  expect(
    PROJECT_SETTINGS.templates.highlight("/w/settings/projects/p/templates-other/", "/w/settings/projects/p")
  ).toBe(false);
});
