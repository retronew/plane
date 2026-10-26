import assert from "node:assert/strict";
import { test } from "node:test";
import type { TFeishuDirectoryPreview } from "@/types/feishu";
import {
  canBindDirectory,
  directorySelections,
  directoryRowStatus,
  directorySummary,
  validDirectoryBatch,
} from "./directory-helper";

const preview: TFeishuDirectoryPreview = {
  id: "preview",
  mode: "unbound",
  status: "complete",
  error: "",
  expires_at: "2030-01-01T00:00:00Z",
  members: [],
  rows: [
    {
      id: "email",
      email: "a@example.com",
      name: "A",
      user_id: "plane-a",
      member_id: "user-a",
      match_basis: "email",
      result: null,
    },
    { id: "manual", email: "", name: "B", user_id: "plane-b", member_id: null, match_basis: "unmatched", result: null },
  ],
};
test("partial and expired previews cannot produce binding requests", () => {
  for (const status of ["partial", "expired"] as const) {
    assert.equal(canBindDirectory({ ...preview, status }), false);
    assert.deepEqual(directorySelections({ ...preview, status }, ["email"], {}), []);
  }
  assert.equal(canBindDirectory(preview, Date.parse(preview.expires_at)), false);
});
test("automatic matches omit overrides and manual matches include explicit users", () => {
  assert.deepEqual(directorySelections(preview, ["email", "manual"], { manual: "user-b" }), [
    { row_id: "email" },
    { row_id: "manual", member_id: "user-b" },
  ]);
});
test("missing targets, unknown rows, and duplicate users are excluded", () => {
  assert.deepEqual(directorySelections(preview, ["manual", "unknown"], {}), []);
  assert.deepEqual(directorySelections(preview, ["email", "manual"], { manual: "user-a" }), [{ row_id: "email" }]);
});
test("rows with reported outcomes cannot be submitted again", () => {
  for (const result of ["already_bound", "bound", "conflict", "user_ineligible", "match_changed"] as const) {
    assert.deepEqual(directorySelections({ ...preview, rows: [{ ...preview.rows[0], result }] }, ["email"], {}), []);
  }
});

test("batch accepts 20 targets but rejects zero or 21", () => {
  assert.equal(validDirectoryBatch([]), false);
  const items = Array.from({ length: 20 }, (_, index) => ({ row_id: String(index) }));
  assert.equal(validDirectoryBatch(items), true);
  assert.equal(validDirectoryBatch([...items, { row_id: "21" }]), false);
});
test("OIDC matches bind without override and identity conflicts cannot bind manually", () => {
  const oidc = { ...preview, rows: [{ ...preview.rows[0], match_basis: "oidc" as const }] };
  assert.deepEqual(directorySelections(oidc, ["email"], {}), [{ row_id: "email" }]);
  const conflict = { ...preview, rows: [{ ...preview.rows[1], match_basis: "identity_conflict" as const }] };
  assert.deepEqual(directorySelections(conflict, ["manual"], { manual: "user-b" }), []);
});

test("email override sends explicit target while OIDC cannot be overridden", () => {
  assert.deepEqual(directorySelections(preview, ["email"], { email: "replacement" }), [
    { row_id: "email", member_id: "replacement" },
  ]);
  const oidc = { ...preview, rows: [{ ...preview.rows[0], match_basis: "oidc" as const }] };
  assert.deepEqual(directorySelections(oidc, ["email"], { email: "replacement" }), [{ row_id: "email" }]);
});
test("skipped automatic match is omitted from request", () => {
  assert.deepEqual(directorySelections(preview, ["manual"], { manual: "user-b" }), [
    { row_id: "manual", member_id: "user-b" },
  ]);
});

test("unmatched new members stay pending until explicitly skipped or selected", () => {
  assert.equal(directoryRowStatus(preview.rows[1], false, false), "pending");
  assert.equal(directoryRowStatus(preview.rows[1], false, true), "skipped");
  assert.equal(directoryRowStatus(preview.rows[1], true, false, "user-b"), "manual");
  assert.deepEqual(directorySummary(preview, ["email"], [], {}), {
    automatic: 1,
    manual: 0,
    pending: 1,
    skipped: 0,
    existing: 0,
  });
  assert.deepEqual(directorySummary(preview, [], ["email"], {}), {
    automatic: 0,
    manual: 0,
    pending: 1,
    skipped: 1,
    existing: 0,
  });
});
test("full review keeps existing bindings read-only even with a manual override", () => {
  const all = {
    ...preview,
    mode: "all" as const,
    rows: [{ ...preview.rows[0], result: "already_bound" as const }, preview.rows[1]],
  };
  assert.deepEqual(directorySelections(all, ["email"], { email: "replacement" }), []);
  assert.equal(directoryRowStatus(all.rows[0], true, true, "replacement"), "already_bound");
  assert.deepEqual(directorySummary(all, [], [], {}), { automatic: 0, manual: 0, pending: 1, skipped: 0, existing: 1 });
});
