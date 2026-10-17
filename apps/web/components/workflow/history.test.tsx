import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TWorkflowActivity } from "@plane/types";
import { HistorySnapshot, memberSnapshotChanges } from "./history";
vi.mock("@/components/issues/issue-detail/issue-activity/sort-root", () => ({ ActivitySortRoot: () => null }));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => ({}) }));
beforeEach(async () => {
  await setLanguage("zh-CN");
});
const entry = (action: string, data: TWorkflowActivity["data"]): TWorkflowActivity => ({
  id: "h",
  action,
  data,
  actor_id: null,
  actor_name: "Admin",
  created_at: "2026-10-16T00:00:00Z",
});
it("renders metadata values without misleading member snapshots", () => {
  render(
    <HistorySnapshot
      entry={entry("created", { schema_version: 2, after: { name: "QA flow", state_ids: ["todo", "done"] } })}
    />
  );
  expect(screen.getByText(/名称: QA flow/)).toBeTruthy();
  expect(screen.queryByText(/未记录/)).toBeNull();
});
it("renders migration counts and state mapping", () => {
  render(
    <HistorySnapshot
      entry={entry("migration", {
        schema_version: 2,
        before: { operation: "delete_workflow" },
        after: { affected_count: 3, state_mapping: { old: "new" } },
      })}
    />
  );
  expect(screen.getByText(/受影响工作项数: 3/)).toBeTruthy();
  expect(screen.getByText(/old.*new/)).toBeTruthy();
});
it("compares historical member snapshots without resolving current members", () => {
  const changes = memberSnapshotChanges(
    { members: [{ id: "a", name: "Old" }] },
    { members: [{ id: "b", name: "New" }] }
  );
  expect(changes).toEqual({ added: [{ id: "b", name: "New" }], removed: [{ id: "a", name: "Old" }] });
});
