/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { makeObservable, observableRef, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import { mutate } from "swr";
// types
import type { TIssue, TIssueRelation, TIssueServiceType } from "@plane/types";
// services
import { bootstrapService } from "@/services/bootstrap.service";
import { IssueArchiveService, WorkspaceDraftService, IssueService } from "@/services/issue";
import { issueCollaborationKey } from "@/services/issue/issue-collaboration.service";
// types
import type { IIssueDetail } from "./root.store";

const EMPTY_SUB_ISSUES = {
  sub_issues: [],
  state_distribution: { backlog: [], unstarted: [], started: [], completed: [], cancelled: [] },
};

export interface IIssueStoreActions {
  // actions
  fetchIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TIssue>;
  updateIssue: (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => Promise<void>;
  removeIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  archiveIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  addCycleToIssue: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<void>;
  addIssueToCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => Promise<void>;
  removeIssueFromCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<void>;
  changeModulesInIssue: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    addModuleIds: string[],
    removeModuleIds: string[]
  ) => Promise<void>;
  removeIssueFromModule: (workspaceSlug: string, projectId: string, moduleId: string, issueId: string) => Promise<void>;
  fetchIssueWithIdentifier: (workspaceSlug: string, project_identifier: string, sequence_id: string) => Promise<TIssue>;
}

export interface IIssueStore extends IIssueStoreActions {
  getIsFetchingIssueDetails: (issueId: string | undefined) => boolean;
  // helper methods
  getIssueById: (issueId: string) => TIssue | undefined;
  getIssueIdByIdentifier: (issueIdentifier: string) => string | undefined;
}

export class IssueStore implements IIssueStore {
  fetchingIssueDetails: string | undefined = undefined;
  // root store
  rootIssueDetailStore: IIssueDetail;
  // services
  issueService;
  issueArchiveService;
  draftWorkItemService;

  constructor(rootStore: IIssueDetail, serviceType: TIssueServiceType) {
    makeObservable(this, {
      fetchingIssueDetails: observableRef,
    });
    // root store
    this.rootIssueDetailStore = rootStore;
    // services
    this.issueService = new IssueService(serviceType);
    this.issueArchiveService = new IssueArchiveService(serviceType);
    this.draftWorkItemService = new WorkspaceDraftService();
  }

  getIsFetchingIssueDetails = computedFn((issueId: string | undefined) => {
    if (!issueId) return false;

    return this.fetchingIssueDetails === issueId;
  });

  // helper methods
  getIssueById = computedFn((issueId: string) => {
    if (!issueId) return undefined;
    return this.rootIssueDetailStore.rootIssueStore.issues.getIssueById(issueId) ?? undefined;
  });

  getIssueIdByIdentifier = computedFn((issueIdentifier: string) => {
    if (!issueIdentifier) return undefined;
    return this.rootIssueDetailStore.rootIssueStore.issues.getIssueIdByIdentifier(issueIdentifier) ?? undefined;
  });

  // actions
  fetchIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const query = {
      expand: "issue_reactions,issue_attachments,issue_link,parent",
    };

    this.fetchingIssueDetails = issueId;
    const issue = await this.issueService.retrieve(workspaceSlug, projectId, issueId, query);

    if (!issue) throw new Error("Work item not found");

    const issuePayload = this.addIssueToStore(issue);

    this.rootIssueDetailStore.rootIssueStore.issues.addIssue([issuePayload]);

    // store handlers from issue detail
    // parent
    if (issue && issue?.parent && issue?.parent?.id && issue?.parent?.project_id) {
      this.issueService.retrieve(workspaceSlug, issue.parent.project_id, issue?.parent?.id).then((res) => {
        this.rootIssueDetailStore.rootIssueStore.issues.addIssue([res]);
        return undefined;
      });
    }
    // assignees
    // labels
    // state

    // issue reactions
    if (issue.issue_reactions) this.rootIssueDetailStore.addReactions(issueId, issue.issue_reactions);

    // fetch issue links
    if (issue.issue_link) this.rootIssueDetailStore.addLinks(issueId, issue.issue_link);

    // fetch issue attachments
    if (issue.issue_attachments) this.rootIssueDetailStore.addAttachments(issueId, issue.issue_attachments);

    this.rootIssueDetailStore.addSubscription(issueId, issue.is_subscribed);

    // fetch issue activity
    this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);

    // fetch issue comments
    this.rootIssueDetailStore.comment.fetchComments(workspaceSlug, projectId, issueId);

    // fetch sub issues only when the issue actually has children
    if ((issue.sub_issues_count ?? 0) > 0) {
      this.rootIssueDetailStore.subIssues.fetchSubIssues(workspaceSlug, projectId, issueId);
    } else {
      this.rootIssueDetailStore.subIssues.applySubIssues(issueId, EMPTY_SUB_ISSUES);
    }

    // fetch issue relations
    this.rootIssueDetailStore.relation.fetchRelations(workspaceSlug, projectId, issueId);

    // fetching states only when not already loaded for this project
    const stateStore = this.rootIssueDetailStore.rootIssueStore.rootStore.state;
    if (!stateStore.fetchedMap[projectId]) {
      stateStore.fetchProjectStates(workspaceSlug, projectId);
    }

    return issue;
  };

  addIssueToStore = (issue: TIssue) => {
    const issuePayload: TIssue = {
      id: issue?.id,
      sequence_id: issue?.sequence_id,
      name: issue?.name,
      description_html: issue?.description_html,
      sort_order: issue?.sort_order,
      state_id: issue?.state_id,
      priority: issue?.priority,
      label_ids: issue?.label_ids,
      assignee_ids: issue?.assignee_ids,
      estimate_point: issue?.estimate_point,
      sub_issues_count: issue?.sub_issues_count,
      attachment_count: issue?.attachment_count,
      link_count: issue?.link_count,
      project_id: issue?.project_id,
      parent_id: issue?.parent_id,
      cycle_id: issue?.cycle_id,
      module_ids: issue?.module_ids,
      type_id: issue?.type_id,
      created_at: issue?.created_at,
      updated_at: issue?.updated_at,
      start_date: issue?.start_date,
      target_date: issue?.target_date,
      completed_at: issue?.completed_at,
      started_at: issue?.started_at,
      state_changed_at: issue?.state_changed_at,
      archived_at: issue?.archived_at,
      created_by: issue?.created_by,
      updated_by: issue?.updated_by,
      is_draft: issue?.is_draft,
      is_subscribed: issue?.is_subscribed,
    };

    this.rootIssueDetailStore.rootIssueStore.issues.addIssue([issuePayload]);
    this.fetchingIssueDetails = undefined;

    return issuePayload;
  };

  updateIssue = async (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;

    await Promise.all([
      currentStore.updateIssue(workspaceSlug, projectId, issueId, data),
      this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId),
    ]);
  };

  removeIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;
    currentStore.removeIssue(workspaceSlug, projectId, issueId);
  };

  archiveIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;
    currentStore.archiveIssue(workspaceSlug, projectId, issueId);
  };

  addCycleToIssue = async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
    await this.rootIssueDetailStore.rootIssueStore.cycleIssues.addCycleToIssue(
      workspaceSlug,
      projectId,
      cycleId,
      issueId
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
  };

  addIssueToCycle = async (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => {
    await this.rootIssueDetailStore.rootIssueStore.cycleIssues.addIssueToCycle(
      workspaceSlug,
      projectId,
      cycleId,
      issueIds,
      false
    );
    if (issueIds && issueIds.length > 0)
      await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueIds[0]);
  };

  removeIssueFromCycle = async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
    const cycle = await this.rootIssueDetailStore.rootIssueStore.cycleIssues.removeIssueFromCycle(
      workspaceSlug,
      projectId,
      cycleId,
      issueId
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
    return cycle;
  };

  changeModulesInIssue = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    addModuleIds: string[],
    removeModuleIds: string[]
  ) => {
    await this.rootIssueDetailStore.rootIssueStore.moduleIssues.changeModulesInIssue(
      workspaceSlug,
      projectId,
      issueId,
      addModuleIds,
      removeModuleIds
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
  };

  removeIssueFromModule = async (workspaceSlug: string, projectId: string, moduleId: string, issueId: string) => {
    const currentModule = await this.rootIssueDetailStore.rootIssueStore.moduleIssues.removeIssuesFromModule(
      workspaceSlug,
      projectId,
      moduleId,
      [issueId]
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
    return currentModule;
  };

  fetchIssueWithIdentifier = async (workspaceSlug: string, project_identifier: string, sequence_id: string) => {
    const issueIdentifier = `${project_identifier}-${sequence_id}`;
    const query = {
      expand: "issue_reactions,issue_attachments,issue_link,parent",
    };

    let bootstrapData: Awaited<ReturnType<typeof bootstrapService.getWorkItemBootstrap>> | null = null;
    try {
      bootstrapData = await bootstrapService.getWorkItemBootstrap(workspaceSlug, issueIdentifier);
    } catch {
      bootstrapData = null;
    }

    const issue =
      bootstrapData?.issue ??
      (await this.issueService.retrieveWithIdentifier(workspaceSlug, project_identifier, sequence_id, query));
    const issueId = issue?.id;
    const projectId = issue?.project_id;
    const rootWorkItemDetailStore = this.rootIssueDetailStore.rootIssueStore.issueDetail;

    if (!issue || !projectId || !issueId) throw new Error("Issue not found");

    const issuePayload = this.addIssueToStore(issue);
    this.rootIssueDetailStore.rootIssueStore.issues.addIssue([issuePayload]);

    // handle parent issue if exists (use expanded parent if already complete, otherwise fetch)
    if (issue?.parent && issue?.parent?.id && issue?.parent?.project_id) {
      this.issueService.retrieve(workspaceSlug, issue.parent.project_id, issue.parent.id).then((res) => {
        this.rootIssueDetailStore.rootIssueStore.issues.addIssue([res]);
        return undefined;
      });
    }

    // add identifiers to map
    rootWorkItemDetailStore.rootIssueStore.issues.addIssueIdentifier(issueIdentifier, issueId);

    // add related data
    if (issue.issue_reactions) rootWorkItemDetailStore.addReactions(issueId, issue.issue_reactions);
    if (issue.issue_link) rootWorkItemDetailStore.addLinks(issueId, issue.issue_link);
    if (issue.issue_attachments) rootWorkItemDetailStore.addAttachments(issueId, issue.issue_attachments);
    rootWorkItemDetailStore.addSubscription(issueId, issue.is_subscribed);

    // Hydrate sub-resources directly from work-item bootstrap when available, avoiding 6 extra requests
    if (bootstrapData && Array.isArray(bootstrapData.activities)) {
      const activities = bootstrapData.activities;
      runInAction(() => {
        rootWorkItemDetailStore.activity.activities[issueId] = activities.map((activity) => activity.id);
        activities.forEach((activity) => {
          set(rootWorkItemDetailStore.activity.activityMap, activity.id, activity);
        });
        rootWorkItemDetailStore.activity.loader = undefined;
      });
    } else {
      rootWorkItemDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
    }

    if (bootstrapData && Array.isArray(bootstrapData.comments)) {
      const comments = bootstrapData.comments;
      runInAction(() => {
        rootWorkItemDetailStore.comment.comments[issueId] = comments.map((comment) => comment.id);
        comments.forEach((comment) => {
          rootWorkItemDetailStore.commentReaction.applyCommentReactions(comment.id, comment?.comment_reactions || []);
          set(rootWorkItemDetailStore.comment.commentMap, comment.id, comment);
        });
        rootWorkItemDetailStore.comment.loader = undefined;
      });
    } else {
      rootWorkItemDetailStore.comment.fetchComments(workspaceSlug, projectId, issueId);
    }

    if ((issue.sub_issues_count ?? 0) > 0) {
      if (bootstrapData?.sub_issues) {
        rootWorkItemDetailStore.subIssues.applySubIssues(issueId, bootstrapData.sub_issues);
      } else {
        rootWorkItemDetailStore.subIssues.fetchSubIssues(workspaceSlug, projectId, issueId);
      }
    } else {
      rootWorkItemDetailStore.subIssues.applySubIssues(issueId, EMPTY_SUB_ISSUES);
    }

    if (bootstrapData?.relations) {
      const relations = bootstrapData.relations;
      runInAction(() => {
        rootWorkItemDetailStore.relation.relationMap[issueId] = Object.fromEntries(
          Object.entries(relations).map(([key, relatedIssues]) => [
            key,
            relatedIssues.flat().map((related) => related.id),
          ])
        ) as Record<keyof TIssueRelation, string[]>;
        rootWorkItemDetailStore.rootIssueStore.issues.addIssue(Object.values(relations).flat());
      });
    } else {
      rootWorkItemDetailStore.relation.fetchRelations(workspaceSlug, projectId, issueId);
    }

    if (bootstrapData?.collaboration) {
      void mutate(issueCollaborationKey(workspaceSlug, projectId, issueId), bootstrapData.collaboration, false);
    }
    if (bootstrapData?.description_versions) {
      void mutate(`DESCRIPTION_VERSIONS_LIST_${issueId}`, bootstrapData.description_versions, false);
    }

    return issue;
  };
}
