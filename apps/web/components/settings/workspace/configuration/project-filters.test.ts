import { expect, it } from "vitest";
import type { TProject } from "@plane/types";
import { orderProjects, shouldFilterProject } from "@plane/utils";
it("combines project status and labels and keeps existing access filters", () => {
  const project = { status: "active", labels: ["backend"], network: 2, archived_at: null } as TProject;
  expect(shouldFilterProject(project, {}, { status: ["active"], labels: ["backend"] })).toBe(true);
  expect(shouldFilterProject(project, {}, { status: ["done"], labels: ["backend"] })).toBe(false);
  expect(shouldFilterProject(project, {}, { status: ["active"], labels: ["mobile"] })).toBe(false);
  expect(shouldFilterProject(project, {}, { status: ["active"], access: ["0"] })).toBe(false);
  expect(shouldFilterProject(project, {}, { status: [], labels: [] })).toBe(true);
});

it("sorts descending names and member counts without changing the input list", () => {
  const projects = [
    { name: "Alpha", members: ["one"] },
    { name: "Beta", members: ["one", "two"] },
  ] as TProject[];
  expect(orderProjects(projects, "-name").map((project) => project.name)).toEqual(["Beta", "Alpha"]);
  expect(orderProjects(projects, "-members_length").map((project) => project.name)).toEqual(["Beta", "Alpha"]);
  expect(projects.map((project) => project.name)).toEqual(["Alpha", "Beta"]);
});
