/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { TIssuePriorities, TWorkspaceDraftIssue } from "@plane/types";

export type TDraftGroupBy = "project" | "priority" | "none";
export type TDraftSortBy = "updated_at" | "created_at" | "name" | "priority";

export const DRAFT_PRIORITY_ORDER: readonly TIssuePriorities[] = ["urgent", "high", "medium", "low", "none"];

const PRIORITY_RANK: Record<TIssuePriorities, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export type TDraftGroup = {
  id: string;
  issueIds: string[];
};

export type TDraftFilterSortGroupInput = {
  issueIds: string[];
  getIssueById: (issueId: string) => TWorkspaceDraftIssue | undefined;
  getProjectMeta: (projectId: string | null | undefined) => { name?: string; identifier?: string } | undefined;
  searchQuery: string;
  projectIds: string[];
  priorities: TIssuePriorities[];
  groupBy: TDraftGroupBy;
  sortBy: TDraftSortBy;
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function filterSortAndGroupDraftIssues({
  issueIds,
  getIssueById,
  getProjectMeta,
  searchQuery,
  projectIds,
  priorities,
  groupBy,
  sortBy,
}: TDraftFilterSortGroupInput): { filteredIds: string[]; groups: TDraftGroup[] } {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const projectSet = projectIds.length > 0 ? new Set(projectIds) : null;
  const prioritySet = priorities.length > 0 ? new Set(priorities) : null;

  const matchingIssues: TWorkspaceDraftIssue[] = [];
  for (const id of issueIds) {
    const issue = getIssueById(id);
    if (!issue) continue;
    if (projectSet && (!issue.project_id || !projectSet.has(issue.project_id))) continue;
    const issuePriority: TIssuePriorities = issue.priority ?? "none";
    if (prioritySet && !prioritySet.has(issuePriority)) continue;
    if (normalizedQuery) {
      const projectMeta = getProjectMeta(issue.project_id);
      const haystack = `${issue.name ?? ""} ${projectMeta?.identifier ?? ""} ${projectMeta?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) continue;
    }
    matchingIssues.push(issue);
  }

  matchingIssues.sort((a, b) => {
    switch (sortBy) {
      case "created_at":
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
      case "name":
        return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
      case "priority": {
        const rankDiff = PRIORITY_RANK[a.priority ?? "none"] - PRIORITY_RANK[b.priority ?? "none"];
        if (rankDiff !== 0) return rankDiff;
        return toTimestamp(b.updated_at ?? b.created_at) - toTimestamp(a.updated_at ?? a.created_at);
      }
      case "updated_at":
      default:
        return toTimestamp(b.updated_at ?? b.created_at) - toTimestamp(a.updated_at ?? a.created_at);
    }
  });

  const filteredIds = matchingIssues.map((issue) => issue.id);

  if (groupBy === "none") {
    return {
      filteredIds,
      groups: filteredIds.length > 0 ? [{ id: "all", issueIds: filteredIds }] : [],
    };
  }

  if (groupBy === "priority") {
    const buckets = new Map<TIssuePriorities, string[]>();
    for (const issue of matchingIssues) {
      const key: TIssuePriorities = issue.priority ?? "none";
      const list = buckets.get(key);
      if (list) list.push(issue.id);
      else buckets.set(key, [issue.id]);
    }
    const groups: TDraftGroup[] = [];
    for (const priority of DRAFT_PRIORITY_ORDER) {
      const ids = buckets.get(priority);
      if (ids && ids.length > 0) groups.push({ id: priority, issueIds: ids });
    }
    return { filteredIds, groups };
  }

  // groupBy === "project"
  const projectBuckets = new Map<string, string[]>();
  for (const issue of matchingIssues) {
    const key = issue.project_id ?? "unassigned";
    const list = projectBuckets.get(key);
    if (list) list.push(issue.id);
    else projectBuckets.set(key, [issue.id]);
  }
  const groups: TDraftGroup[] = [...projectBuckets.entries()]
    .toSorted(([aId], [bId]) => {
      const aName = getProjectMeta(aId)?.name ?? aId;
      const bName = getProjectMeta(bId)?.name ?? bId;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    })
    .map(([id, ids]) => ({ id, issueIds: ids }));

  return { filteredIds, groups };
}

type TWorkspaceDraftViewContext = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  projectIds: string[];
  toggleProjectId: (projectId: string) => void;
  priorities: TIssuePriorities[];
  togglePriority: (priority: TIssuePriorities) => void;
  groupBy: TDraftGroupBy;
  setGroupBy: (groupBy: TDraftGroupBy) => void;
  sortBy: TDraftSortBy;
  setSortBy: (sortBy: TDraftSortBy) => void;
  collapsedGroups: Record<string, boolean>;
  toggleGroupCollapsed: (groupId: string) => void;
  clearFilters: () => void;
  clearAll: () => void;
  activeFilterCount: number;
  hasActiveFiltersOrSearch: boolean;
};

const DEFAULT_CONTEXT: TWorkspaceDraftViewContext = {
  searchQuery: "",
  setSearchQuery: () => {},
  projectIds: [],
  toggleProjectId: () => {},
  priorities: [],
  togglePriority: () => {},
  groupBy: "project",
  setGroupBy: () => {},
  sortBy: "updated_at",
  setSortBy: () => {},
  collapsedGroups: {},
  toggleGroupCollapsed: () => {},
  clearFilters: () => {},
  clearAll: () => {},
  activeFilterCount: 0,
  hasActiveFiltersOrSearch: false,
};

const WorkspaceDraftViewContext = createContext<TWorkspaceDraftViewContext>(DEFAULT_CONTEXT);

export function WorkspaceDraftViewProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<TIssuePriorities[]>([]);
  const [groupBy, setGroupBy] = useState<TDraftGroupBy>("project");
  const [sortBy, setSortBy] = useState<TDraftSortBy>("updated_at");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleProjectId = useCallback((projectId: string) => {
    setProjectIds((prev) => (prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]));
  }, []);

  const togglePriority = useCallback((priority: TIssuePriorities) => {
    setPriorities((prev) => (prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]));
  }, []);

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const clearFilters = useCallback(() => {
    setProjectIds([]);
    setPriorities([]);
  }, []);

  const clearAll = useCallback(() => {
    setSearchQuery("");
    setProjectIds([]);
    setPriorities([]);
  }, []);

  const activeFilterCount = projectIds.length + priorities.length;
  const hasActiveFiltersOrSearch = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const value = useMemo<TWorkspaceDraftViewContext>(
    () => ({
      searchQuery,
      setSearchQuery,
      projectIds,
      toggleProjectId,
      priorities,
      togglePriority,
      groupBy,
      setGroupBy,
      sortBy,
      setSortBy,
      collapsedGroups,
      toggleGroupCollapsed,
      clearFilters,
      clearAll,
      activeFilterCount,
      hasActiveFiltersOrSearch,
    }),
    [
      searchQuery,
      projectIds,
      toggleProjectId,
      priorities,
      togglePriority,
      groupBy,
      sortBy,
      collapsedGroups,
      toggleGroupCollapsed,
      clearFilters,
      clearAll,
      activeFilterCount,
      hasActiveFiltersOrSearch,
    ]
  );

  return <WorkspaceDraftViewContext.Provider value={value}>{children}</WorkspaceDraftViewContext.Provider>;
}

export function useWorkspaceDraftView(): TWorkspaceDraftViewContext {
  return useContext(WorkspaceDraftViewContext);
}
