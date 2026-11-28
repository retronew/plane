/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { TWorkspaceDraftIssue } from "@plane/types";
import { filterSortAndGroupDraftIssues } from "./draft-view-context";

const makeDraft = (overrides: Partial<TWorkspaceDraftIssue> & { id: string }): TWorkspaceDraftIssue =>
  ({
    name: "Untitled",
    project_id: "proj-a",
    priority: "medium",
    state_id: "state-1",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  }) as TWorkspaceDraftIssue;

const PROJECTS: Record<string, { name: string; identifier: string }> = {
  "proj-a": { name: "Alpha", identifier: "ALP" },
  "proj-b": { name: "Beta", identifier: "BET" },
};

describe("filterSortAndGroupDraftIssues", () => {
  const drafts: Record<string, TWorkspaceDraftIssue> = {
    d1: makeDraft({
      id: "d1",
      name: "Fix login redirect",
      project_id: "proj-b",
      priority: "urgent",
      updated_at: "2026-11-28T08:00:00Z",
    }),
    d2: makeDraft({
      id: "d2",
      name: "Add dark mode tokens",
      project_id: "proj-a",
      priority: "low",
      updated_at: "2026-11-28T10:00:00Z",
    }),
    d3: makeDraft({
      id: "d3",
      name: "Billing webhook retry",
      project_id: "proj-a",
      priority: "high",
      updated_at: "2026-11-28T09:00:00Z",
    }),
  };
  const issueIds = ["d1", "d2", "d3"];

  it("groups by project alphabetically and sorts rows by updated_at descending", () => {
    const result = filterSortAndGroupDraftIssues({
      issueIds,
      getIssueById: (id) => drafts[id],
      getProjectMeta: (pid) => (pid ? PROJECTS[pid] : undefined),
      searchQuery: "",
      projectIds: [],
      priorities: [],
      groupBy: "project",
      sortBy: "updated_at",
    });

    expect(result.groups).toEqual([
      { id: "proj-a", issueIds: ["d2", "d3"] },
      { id: "proj-b", issueIds: ["d1"] },
    ]);
  });

  it("filters by search query across title and project identifier, plus priority filter", () => {
    const byIdentifier = filterSortAndGroupDraftIssues({
      issueIds,
      getIssueById: (id) => drafts[id],
      getProjectMeta: (pid) => (pid ? PROJECTS[pid] : undefined),
      searchQuery: "bet",
      projectIds: [],
      priorities: [],
      groupBy: "none",
      sortBy: "updated_at",
    });
    expect(byIdentifier.filteredIds).toEqual(["d1"]);

    const byPriority = filterSortAndGroupDraftIssues({
      issueIds,
      getIssueById: (id) => drafts[id],
      getProjectMeta: (pid) => (pid ? PROJECTS[pid] : undefined),
      searchQuery: "",
      projectIds: [],
      priorities: ["urgent", "high"],
      groupBy: "priority",
      sortBy: "priority",
    });
    expect(byPriority.groups).toEqual([
      { id: "urgent", issueIds: ["d1"] },
      { id: "high", issueIds: ["d3"] },
    ]);
  });

  it("sorts by name ascending when sortBy is name", () => {
    const result = filterSortAndGroupDraftIssues({
      issueIds,
      getIssueById: (id) => drafts[id],
      getProjectMeta: (pid) => (pid ? PROJECTS[pid] : undefined),
      searchQuery: "",
      projectIds: [],
      priorities: [],
      groupBy: "none",
      sortBy: "name",
    });
    expect(result.filteredIds).toEqual(["d2", "d3", "d1"]);
  });
});
