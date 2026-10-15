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

it("filters priority with existing filters and handles legacy unset priorities", () => {
  const project = { priority: "high", network: 2, archived_at: null } as TProject;
  expect(shouldFilterProject(project, {}, { priority: ["high", "urgent"], access: ["2"] })).toBe(true);
  expect(shouldFilterProject(project, {}, { priority: ["low"] })).toBe(false);
  expect(shouldFilterProject({ ...project, priority: undefined }, {}, { priority: ["none"] })).toBe(true);
});
it("sorts creation time descending by the actual timestamp", () => {
  const projects = [
    { id: "old", name: "Old", created_at: "2026-10-01T00:00:00Z" },
    { id: "new", name: "New", created_at: "2026-10-15T00:00:00Z" },
  ] as unknown as TProject[];
  expect(orderProjects(projects, "-created_at").map((project) => project.id)).toEqual(["new", "old"]);
  expect(projects.map((project) => project.id)).toEqual(["old", "new"]);
});
