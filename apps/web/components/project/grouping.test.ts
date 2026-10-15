import { expect, it } from "vitest";
import type { IProject } from "@plane/types";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { getProjectGroupCreateDefaults, groupProjectRecords } from "./grouping";
const statuses = [
  { id: "draft", group: "draft", is_default: true },
  { id: "ready", group: "draft" },
  { id: "active", group: "execution" },
] as ProjectCategory[];
const labels = [{ id: "a" }, { id: "b" }] as ProjectCategory[];
const project = (id: string, fields: Partial<IProject> = {}) => ({ id, ...fields }) as IProject;
it("groups priorities in the fixed priority order including unset legacy priorities", () => {
  const result = groupProjectRecords([project("a", { priority: "high" }), project("b")], statuses, labels, "priority");
  expect(result.map((g) => g.id)).toEqual(["urgent", "high", "medium", "low", "none"]);
  expect(result.find((g) => g.id === "high")?.projects.map((p) => p.id)).toEqual(["a"]);
  expect(result.find((g) => g.id === "none")?.projects.map((p) => p.id)).toEqual(["b"]);
});
it("combines workspace statuses into phases without changing the order within a phase", () => {
  const result = groupProjectRecords(
    [project("a", { status: "ready" }), project("b"), project("c", { status: "active" })],
    statuses,
    labels,
    "state_group"
  );
  expect(result.map((g) => [g.id, g.projects.map((p) => p.id)])).toEqual([
    ["draft", ["a", "b"]],
    ["execution", ["c"]],
    ["unassigned", []],
  ]);
});
it("includes multi-label projects in each label and preserves missing/deleted labels", () => {
  const result = groupProjectRecords(
    [project("a", { labels: ["a", "b"] }), project("b", { labels: ["deleted"] }), project("c")],
    statuses,
    labels,
    "labels"
  );
  expect(result.map((g) => [g.id, g.projects.map((p) => p.id)])).toEqual([
    ["a", ["a"]],
    ["b", ["a"]],
    ["unassigned", ["b", "c"]],
  ]);
});
it("keeps every creator including unknown users and preserves the incoming project order", () => {
  const projects = [project("a", { created_by: "u1" }), project("b"), project("c", { created_by: "u1" })];
  expect(groupProjectRecords(projects, statuses, labels, "created_by").map((g) => g.projects.map((p) => p.id))).toEqual(
    [["a", "c"], ["b"]]
  );
  expect(projects.map((p) => p.id)).toEqual(["a", "b", "c"]);
});

it("prefills the writable grouping field and never overwrites the creator", () => {
  expect(getProjectGroupCreateDefaults({ id: "ready", projects: [], status: statuses[1] }, "status", statuses)).toEqual(
    { status: "ready" }
  );
  expect(getProjectGroupCreateDefaults({ id: "draft", projects: [], phase: "draft" }, "state_group", statuses)).toEqual(
    { status: "draft" }
  );
  expect(getProjectGroupCreateDefaults({ id: "high", projects: [], priority: "high" }, "priority", statuses)).toEqual({
    priority: "high",
  });
  expect(getProjectGroupCreateDefaults({ id: "a", projects: [], label: labels[0] }, "labels", statuses)).toEqual({
    labels: ["a"],
  });
  expect(getProjectGroupCreateDefaults({ id: "unassigned", projects: [] }, "labels", statuses)).toEqual({ labels: [] });
  expect(
    getProjectGroupCreateDefaults({ id: "u1", projects: [], creator: "u1" }, "created_by", statuses, "u1")
  ).toEqual({});
  expect(
    getProjectGroupCreateDefaults({ id: "u2", projects: [], creator: "u2" }, "created_by", statuses, "u1")
  ).toBeNull();
  expect(getProjectGroupCreateDefaults({ id: "unassigned", projects: [] }, "status", statuses)).toBeNull();
});
