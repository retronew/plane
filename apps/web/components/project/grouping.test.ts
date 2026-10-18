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
it("matches every duplicate label group once per project and preserves configuration order", () => {
  const duplicateLabels = [{ id: "b" }, { id: "a" }, { id: "b" }, { id: "empty" }] as ProjectCategory[];
  const projects = [
    project("first", { labels: ["a", "b", "b", "deleted"] }),
    project("second", { labels: ["b"] }),
    project("unknown", { labels: ["deleted"] }),
    project("missing"),
  ];
  const result = groupProjectRecords(projects, statuses, duplicateLabels, "labels");
  expect(result.map((group) => [group.id, group.projects.map((item) => item.id)])).toEqual([
    ["b", ["first", "second"]],
    ["a", ["first"]],
    ["b", ["first", "second"]],
    ["empty", []],
    ["unassigned", ["unknown", "missing"]],
  ]);
  expect(result[0].label).toBe(duplicateLabels[0]);
  expect(result[2].label).toBe(duplicateLabels[2]);
  expect(projects[0].labels).toEqual(["a", "b", "b", "deleted"]);
  expect(duplicateLabels.map((label) => label.id)).toEqual(["b", "a", "b", "empty"]);
});
it("uses the first duplicate status mapping while retaining empty phases and the first default", () => {
  const duplicateStatuses = [
    { id: "shared", group: "first", is_default: true },
    { id: "shared", group: "second" },
    { id: "other", group: "third", is_default: true },
  ] as ProjectCategory[];
  const result = groupProjectRecords(
    [project("implicit"), project("explicit", { status: "shared" }), project("unknown", { status: "deleted" })],
    duplicateStatuses,
    labels,
    "state_group"
  );
  expect(result.map((group) => [group.id, group.projects.map((item) => item.id)])).toEqual([
    ["first", ["implicit", "explicit"]],
    ["second", []],
    ["third", []],
    ["unassigned", ["unknown"]],
  ]);
});
it("retains the unassigned group with empty configurations and empty input", () => {
  for (const by of ["labels", "state_group"] as const) {
    expect(groupProjectRecords([], [], [], by)).toEqual([{ id: "unassigned", projects: [] }]);
    const projects = [project("a"), project("b", { labels: ["deleted"], status: "deleted" })];
    expect(groupProjectRecords(projects, [], [], by)).toEqual([{ id: "unassigned", projects }]);
  }
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
