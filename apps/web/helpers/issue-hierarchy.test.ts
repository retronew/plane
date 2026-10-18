import { expect, it } from "vitest";
import type { TProjectIssueType } from "@plane/types";
import { hierarchyErrorKey, hierarchyTypeSearchParam, issueTypeLevel, legalChildTypeIds } from "./issue-hierarchy";

const types: TProjectIssueType[] = [
  {
    project_issue_type_id: "p-task",
    id: "task",
    name: "Task",
    level: 0,
    is_default: true,
    is_active: true,
    workflow_id: null,
  },
  {
    project_issue_type_id: "p-story",
    id: "story",
    name: "Story",
    level: 1,
    is_default: false,
    is_active: true,
    workflow_id: null,
  },
  {
    project_issue_type_id: "p-epic",
    id: "epic",
    name: "Epic",
    level: 2,
    is_default: false,
    is_active: true,
    workflow_id: null,
  },
  {
    project_issue_type_id: "p-inactive",
    id: "inactive",
    name: "Inactive",
    level: 1,
    is_default: false,
    is_active: false,
    workflow_id: null,
  },
];

it("keeps omitted and explicitly null type contexts distinct", () => {
  expect(hierarchyTypeSearchParam(undefined)).toBeUndefined();
  expect(hierarchyTypeSearchParam(null)).toBe("null");
  expect(hierarchyTypeSearchParam("story")).toBe("story");
  expect(issueTypeLevel(types, null)).toBe(0);
  expect(issueTypeLevel(types, "missing")).toBeUndefined();
  expect(issueTypeLevel(types, undefined)).toBe(0);
});
it("offers only active types exactly one level below the parent", () => {
  expect(legalChildTypeIds(types, "epic")).toEqual(["story"]);
  expect(legalChildTypeIds(types, "story")).toEqual(["task"]);
  expect(legalChildTypeIds(types, "task")).toEqual([]);
  expect(legalChildTypeIds(types, null)).toEqual([]);
});
it("reads hierarchy errors from service and axios responses", () => {
  expect(hierarchyErrorKey({ hierarchy: ["HIERARCHY_INVALID_LEVEL"] })).toBe("web.issue_hierarchy.invalid_level");
  expect(hierarchyErrorKey({ response: { data: { hierarchy: ["HIERARCHY_CYCLE"] } } })).toBe(
    "web.issue_hierarchy.cycle"
  );
  expect(hierarchyErrorKey({ hierarchy: ["HIERARCHY_CHILDREN_CONFLICT"] })).toBe(
    "web.issue_hierarchy.children_conflict"
  );
  expect(hierarchyErrorKey(new Error())).toBe("web.issue_hierarchy.save_failed");
  expect(hierarchyErrorKey(new Error(), "")).toBe("");
});
