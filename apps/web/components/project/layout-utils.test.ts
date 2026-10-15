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
  it("shows all projects together when workspace statuses are disabled", () => {
    expect(
      groupProjects([project("a", { status: "unknown" }), project("b")], [])[0].projects.map((item) => item.id)
    ).toEqual(["a", "b"]);
  });
});
