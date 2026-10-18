import { describe, expect, it } from "vitest";
import type { IProject } from "@plane/types";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { groupProjects } from "./layout-utils";
const project = (id: string, changes: Partial<IProject> = {}) => ({ id, ...changes }) as IProject;
const statuses = [{ id: "draft", is_default: true }, { id: "active" }] as ProjectCategory[];
describe("project layouts", () => {
  it("keeps configured status order, empty groups and the current project ordering", () => {
    const projects = [
      project("a", { status: "active" }),
      project("b"),
      project("c", { status: "active" }),
      project("d", { status: "deleted" }),
    ];
    const groups = groupProjects(projects, statuses);
    expect(groups.map((group) => [group.id, group.projects.map((item) => item.id)])).toEqual([
      ["draft", ["b"]],
      ["active", ["a", "c"]],
      ["unassigned", ["d"]],
    ]);
    expect(groupProjects([], statuses).map((group) => group.id)).toEqual(["draft", "active"]);
    expect(projects.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("assigns duplicate status IDs only to the first configured group", () => {
    const duplicateStatuses = [
      { id: "draft", is_default: true, name: "First" },
      { id: "draft", name: "Second" },
      { id: "empty" },
    ] as ProjectCategory[];
    const projects = [project("a"), project("b", { status: "draft" }), project("c", { status: "deleted" })];
    const groups = groupProjects(projects, duplicateStatuses);
    expect(groups.map((group) => [group.id, group.projects.map((item) => item.id)])).toEqual([
      ["draft", ["a", "b"]],
      ["draft", []],
      ["empty", []],
      ["unassigned", ["c"]],
    ]);
    expect(groups[0].status).toBe(duplicateStatuses[0]);
    expect(groups[1].status).toBe(duplicateStatuses[1]);
    expect(duplicateStatuses).toHaveLength(3);
    expect(projects.map((item) => item.status)).toEqual([undefined, "draft", "deleted"]);
  });
  it("keeps missing statuses unassigned when no default is configured", () => {
    const groups = groupProjects([project("a"), project("b", { status: "draft" })], [
      { id: "draft" },
    ] as ProjectCategory[]);
    expect(groups.map((group) => [group.id, group.projects.map((item) => item.id)])).toEqual([
      ["draft", ["b"]],
      ["unassigned", ["a"]],
    ]);
  });
  it("shows all projects together when workspace statuses are disabled", () => {
    expect(
      groupProjects([project("a", { status: "unknown" }), project("b")], [])[0].projects.map((item) => item.id)
    ).toEqual(["a", "b"]);
  });
});
