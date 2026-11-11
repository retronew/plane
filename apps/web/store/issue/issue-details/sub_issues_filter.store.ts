/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { EIssueFilterType } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  ISubWorkItemFilters,
  TGroupedIssues,
  TIssue,
} from "@plane/types";
import {
  getFilteredWorkItems,
  getGroupedWorkItemIds,
  getOrderedWorkItems,
  updateSubWorkItemFilters,
} from "../helpers/base-issues-utils";
import type { IssueSubIssuesStore } from "./sub_issues.store";

export const DEFAULT_DISPLAY_PROPERTIES = {
  key: true,
  issue_type: true,
  assignee: true,
  start_date: true,
  due_date: true,
  labels: true,
  priority: true,
  state: true,
};
export interface IWorkItemSubIssueFiltersStore {
  subIssueFilters: Record<string, Partial<ISubWorkItemFilters>>;
  // helpers methods
  updateSubWorkItemFilters: (
    filterType: EIssueFilterType,
    filters: IIssueDisplayFilterOptions | IIssueDisplayProperties | IIssueFilterOptions,
    workItemId: string
  ) => void;
  getGroupedSubWorkItems: (workItemId: string) => TGroupedIssues;
  getVisibleSubWorkItemIds: (parentId: string, rootId: string) => string[];
  getFilteredSubWorkItems: (workItemId: string, filters: IIssueFilterOptions) => TIssue[];
  getSubIssueFilters: (workItemId: string) => Partial<ISubWorkItemFilters>;
  resetFilters: (workItemId: string) => void;
}

export class WorkItemSubIssueFiltersStore implements IWorkItemSubIssueFiltersStore {
  // observables
  subIssueFilters: Record<string, Partial<ISubWorkItemFilters>> = {};

  // root store
  subIssueStore: IssueSubIssuesStore;

  constructor(subIssueStore: IssueSubIssuesStore) {
    makeObservable(this, {
      subIssueFilters: observable,
      updateSubWorkItemFilters: action,
      getSubIssueFilters: action,
    });

    // root store
    this.subIssueStore = subIssueStore;
  }

  /**
   * @description This method is used to get the sub issue filters
   * @param workItemId
   * @returns
   */
  getSubIssueFilters = (workItemId: string) => {
    if (!this.subIssueFilters[workItemId]) {
      this.initializeFilters(workItemId);
    }
    return this.subIssueFilters[workItemId];
  };

  /**
   * @description This method is used to initialize the sub issue filters
   * @param workItemId
   */
  initializeFilters = (workItemId: string) => {
    set(this.subIssueFilters, [workItemId, "displayProperties"], DEFAULT_DISPLAY_PROPERTIES);
    set(this.subIssueFilters, [workItemId, "filters"], {});
    set(this.subIssueFilters, [workItemId, "displayFilters"], {});
  };

  /**
   * @description This method updates filters for sub issues.
   * @param filterType
   * @param filters
   */
  updateSubWorkItemFilters = (
    filterType: EIssueFilterType,
    filters: IIssueDisplayFilterOptions | IIssueDisplayProperties | IIssueFilterOptions,
    workItemId: string
  ) => {
    runInAction(() => {
      updateSubWorkItemFilters(this.subIssueFilters, filterType, filters, workItemId);
    });
  };

  /**
   * @description This method is used to get the grouped sub work items
   * @param parentWorkItemId
   * @returns
   */
  getGroupedSubWorkItems = computedFn((parentWorkItemId: string) => {
    const subIssueFilters = this.getSubIssueFilters(parentWorkItemId);

    const visibleIds = this.getVisibleSubWorkItemIds(parentWorkItemId, parentWorkItemId);
    const filteredWorkItems = this.subIssueStore.rootIssueDetailStore.rootIssueStore.issues.getIssuesByIds(
      visibleIds,
      "un-archived"
    );

    // get group by and order by
    const groupByKey = subIssueFilters.displayFilters?.group_by;
    const orderByKey = subIssueFilters.displayFilters?.order_by;

    const groupedWorkItemIds = getGroupedWorkItemIds(filteredWorkItems, groupByKey, orderByKey);

    return groupedWorkItemIds;
  });

  /**
   * @description This method is used to get the filtered sub work items
   * @param workItemId
   * @returns
   */
  getFilteredSubWorkItems = computedFn((workItemId: string, filters: IIssueFilterOptions) =>
    getFilteredWorkItems(this.getSubWorkItemTree(workItemId).workItems, filters)
  );

  // Follow only accessible, active parent paths. A missing ancestor must not promote its children.
  getSubWorkItemTree = computedFn((rootId: string) => {
    const includeDescendants = this.getSubIssueFilters(rootId).displayFilters?.sub_issue ?? true;
    const workItems: TIssue[] = [];
    const parentById = new Map<string, string>();
    const seen = new Set([rootId]);
    const pending = [rootId];
    for (let index = 0; index < pending.length; index++) {
      const parentId = pending[index];
      const children = this.subIssueStore.rootIssueDetailStore.rootIssueStore.issues.getIssuesByIds(
        this.subIssueStore.subIssuesByIssueId(parentId) ?? [],
        "un-archived"
      );
      for (const child of children) {
        if (seen.has(child.id) || child.is_draft || child.archived_at) continue;
        seen.add(child.id);
        parentById.set(child.id, parentId);
        workItems.push(child);
        if (includeDescendants) pending.push(child.id);
      }
    }
    return { workItems, parentById };
  });

  getVisibleSubWorkItemIds = computedFn(
    (parentId: string, rootId: string): string[] => this.getVisibleSubWorkItemIdsByParent(rootId).get(parentId) ?? []
  );

  // Shared by all rendered levels so filtering and ancestor expansion happen once per root.
  getVisibleSubWorkItemIdsByParent = computedFn((rootId: string) => {
    const filters = this.getSubIssueFilters(rootId);
    const { workItems, parentById } = this.getSubWorkItemTree(rootId);
    const visibleIds = new Set<string>();
    for (const match of getFilteredWorkItems(workItems, filters.filters ?? {})) {
      let id: string | undefined = match.id;
      while (id && id !== rootId && !visibleIds.has(id)) {
        visibleIds.add(id);
        id = parentById.get(id);
      }
    }
    const itemsByParent = new Map<string, TIssue[]>();
    for (const item of workItems) {
      if (!visibleIds.has(item.id)) continue;
      const parentId = parentById.get(item.id)!;
      const siblings = itemsByParent.get(parentId) ?? [];
      siblings.push(item);
      itemsByParent.set(parentId, siblings);
    }
    return new Map(
      [...itemsByParent].map(([parentId, items]) => [
        parentId,
        getOrderedWorkItems(items, filters.displayFilters?.order_by ?? "-created_at"),
      ])
    );
  });

  /**
   * @description This method is used to reset the filters
   * @param workItemId
   */
  resetFilters = (workItemId: string) => {
    this.initializeFilters(workItemId);
  };
}
