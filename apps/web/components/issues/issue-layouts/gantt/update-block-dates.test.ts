import { expect, it, vi } from "vitest";
import type { TIssueMap } from "@plane/types";
import { updateGanttIssueDates } from "./update-block-dates";
const issueMap = {
  a: { project_id: "one" },
  b: { project_id: "two" },
  c: { project_id: "one" },
  restricted: { project_id: "three" },
} as unknown as TIssueMap;
it("saves each project through its own endpoint and excludes inaccessible or missing items", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const updates = ["a", "b", "c", "restricted", "missing"].map((id) => ({ id, target_date: "2026-10-20" }));
  await updateGanttIssueDates(updates, issueMap, (id) => id !== "restricted", save);
  expect(save.mock.calls).toEqual([
    ["one", [updates[0], updates[2]]],
    ["two", [updates[1]]],
  ]);
});
it("propagates save failures so the caller can show the failure and the store can roll back", async () => {
  const save = vi.fn().mockRejectedValue(new Error("network"));
  await expect(updateGanttIssueDates([{ id: "a" }], issueMap, () => true, save)).rejects.toThrow("network");
});
