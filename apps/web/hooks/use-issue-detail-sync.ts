import { useEffect, useRef } from "react";
import { runInAction } from "mobx";
import type {
  IIssueLabel,
  IState,
  IWorkspaceMember,
  TIssue,
  TIssueActivity,
  TIssueComment,
  TIssueRelation,
  TIssueSubIssues,
} from "@plane/types";
import { API_BASE_URL } from "@plane/constants";
import { issueSync } from "@/lib/sync/issue-sync";
import { APIService } from "@/services/api.service";
import { useIssueDetail } from "./store/use-issue-detail";

class DetailSyncService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
}
const service = new DetailSyncService();

export function useIssueDetailSync(
  workspace?: string,
  projectId?: string,
  issueId?: string,
  onUnavailable?: () => void,
  enabled = true,
  isArchived = false
) {
  const { rootIssueStore } = useIssueDetail();
  const unavailable = useRef(onUnavailable);
  useEffect(() => {
    unavailable.current = onUnavailable;
  }, [onUnavailable]);
  useEffect(() => {
    if (!enabled || !workspace || !projectId || !issueId) return;
    let active = true;
    let controller: AbortController | undefined;
    const abort = () => controller?.abort();
    const revoke = () => {
      if (!active) return;
      abort();
      for (const list of [
        rootIssueStore.projectIssues,
        rootIssueStore.cycleIssues,
        rootIssueStore.moduleIssues,
        rootIssueStore.projectViewIssues,
        rootIssueStore.workspaceIssues,
        rootIssueStore.profileIssues,
        rootIssueStore.archivedIssues,
        rootIssueStore.teamIssues,
        rootIssueStore.teamViewIssues,
      ])
        list.removeIssueFromList(issueId);
      rootIssueStore.issues.removeIssue(issueId);
      const detail = rootIssueStore.issueDetail;
      runInAction(() => {
        if (detail.peekIssue?.issueId === issueId) detail.setPeekIssue(undefined);
        for (const id of detail.comment.comments[issueId] ?? []) {
          delete detail.comment.commentMap[id];
          detail.commentReaction.applyCommentReactions(id, []);
        }
        detail.comment.comments[issueId] = [];
        detail.activity.activities[issueId] = [];
        detail.relation.relationMap[issueId] = {} as Record<keyof TIssueRelation, string[]>;
        detail.subIssues.subIssues[issueId] = [];
        delete detail.subIssues.subIssuesStateDistribution[issueId];
        detail.addAttachments(issueId, []);
        detail.addLinks(issueId, []);
        detail.addReactions(issueId, []);
      });
      unavailable.current?.();
    };
    const unsubscribe = issueSync.subscribe({
      key: JSON.stringify(["detail", workspace, projectId, issueId, isArchived]),
      projectId,
      abort,
      onAccessRevoked: revoke,
      refresh: async (context) => {
        if (!context?.reset && context?.issueIds?.length) {
          // Descendant changes may name only their direct parent; refresh the complete root snapshot.
          const knownIds = new Set<string>();
          const pending = [issueId];
          for (let index = 0; index < pending.length; index++) {
            const id = pending[index];
            if (knownIds.has(id)) continue;
            knownIds.add(id);
            pending.push(...(rootIssueStore.issueDetail.subIssues.subIssues[id] ?? []));
          }
          if (!context.issueIds.some((id) => knownIds.has(id))) return;
        }
        abort();
        const request = new AbortController();
        controller = request;
        const revision = issueSync.revision;
        const valid = () =>
          active &&
          !request.signal.aborted &&
          controller === request &&
          !issueSync.paused &&
          revision === issueSync.revision;
        const base = `/api/workspaces/${workspace}/projects/${projectId}/issues/${issueId}/`;
        const get = async <T>(suffix: string, params = {}): Promise<T> =>
          (await service.get(`${base}${suffix}`, { params, signal: request.signal })).data as T;
        try {
          // Read without invoking fetch methods that commit before the subscription guard.
          // A complete snapshot also detects edits/deletions of older comments and relations.
          const [issue, comments, activities, relations, children] = await Promise.all([
            get<TIssue>(isArchived ? "archive/" : "", {
              expand: "issue_reactions,issue_attachments,issue_link,parent",
            }),
            get<TIssueComment[]>("history/", { activity_type: "issue-comment" }),
            get<TIssueActivity[]>("history/", { activity_type: "issue-property" }),
            get<TIssueRelation>("issue-relation/"),
            get<TIssueSubIssues>("sub-issues/", { include_descendants: true }),
          ]);
          if (!valid()) {
            throw new DOMException("Detail synchronization superseded", "AbortError");
          }
          const previousParentId = rootIssueStore.issues.getIssueById(issueId)?.parent_id;
          const parentIds = [...new Set([issue.parent_id, previousParentId].filter((id): id is string => !!id))];
          const parents = await Promise.all(
            parentIds.map(async (id) => {
              const cached = rootIssueStore.issues.getIssueById(id);
              const parentProject = issue.parent?.id === id ? issue.parent.project_id : cached?.project_id;
              if (!parentProject) return undefined;
              try {
                return (
                  await service.get(`/api/workspaces/${workspace}/projects/${parentProject}/issues/${id}/`, {
                    signal: request.signal,
                  })
                ).data as TIssue;
              } catch (error) {
                const status = (error as { response?: { status?: number } }).response?.status;
                if (status === 403 || status === 404) return undefined;
                throw error;
              }
            })
          );
          const { state: stateStore, label: labelStore, memberRoot } = rootIssueStore.rootStore;
          // Reset also refreshes known IDs: dictionary edits do not change issue IDs.
          const refreshDictionaries = !context || !!context.reset;
          const [states, labels, members] = await Promise.all([
            refreshDictionaries || (issue.state_id && !stateStore.getStateById(issue.state_id))
              ? service
                  .get(`/api/workspaces/${workspace}/projects/${projectId}/states/`, { signal: request.signal })
                  .then((response) => response.data as IState[])
              : [],
            refreshDictionaries || issue.label_ids?.some((id) => !labelStore.getLabelById(id))
              ? service
                  .get(`/api/workspaces/${workspace}/projects/${projectId}/issue-labels/`, { signal: request.signal })
                  .then((response) => response.data as IIssueLabel[])
              : [],
            issue.assignee_ids?.some((id) => !memberRoot.getUserDetails(id))
              ? service
                  .get(`/api/workspaces/${workspace}/members/`, { signal: request.signal })
                  .then((response) => response.data as IWorkspaceMember[])
              : [],
          ]);
          if (!valid()) {
            throw new DOMException("Detail synchronization superseded", "AbortError");
          }
          runInAction(() => {
            const detail = rootIssueStore.issueDetail;
            // DescriptionInput preserves unsaved edits; collaborative editors retain their Yjs document.
            rootIssueStore.issues.addIssue([{ ...rootIssueStore.issues.getIssueById(issueId), ...issue }]);
            rootIssueStore.issues.addIssue(parents.filter((parent): parent is TIssue => !!parent));
            detail.addAttachments(issueId, issue.issue_attachments ?? []);
            detail.addLinks(issueId, issue.issue_link ?? []);
            detail.addReactions(issueId, issue.issue_reactions ?? []);
            detail.addSubscription(issueId, issue.is_subscribed);
            const commentIds = new Set(comments.map((comment) => comment.id));
            for (const id of detail.comment.comments[issueId] ?? []) {
              if (!commentIds.has(id)) {
                delete detail.comment.commentMap[id];
                detail.commentReaction.applyCommentReactions(id, []);
              }
            }
            detail.comment.comments[issueId] = [...commentIds];
            for (const comment of comments) {
              detail.comment.commentMap[comment.id] = comment;
              detail.commentReaction.applyCommentReactions(comment.id, comment.comment_reactions ?? []);
            }
            detail.activity.activities[issueId] = activities.map((activity) => activity.id);
            for (const activity of activities) detail.activity.activityMap[activity.id] = activity;
            detail.relation.relationMap[issueId] = Object.fromEntries(
              Object.entries(relations).map(([key, issues]) => [key, issues.flat().map((related) => related.id)])
            ) as Record<keyof TIssueRelation, string[]>;
            rootIssueStore.issues.addIssue(Object.values(relations).flat());
            detail.subIssues.applySubIssues(issueId, children);
            if (refreshDictionaries) {
              for (const [id, state] of Object.entries(stateStore.stateMap))
                if (state.project_id === projectId) delete stateStore.stateMap[id];
              for (const [id, label] of Object.entries(labelStore.labelMap))
                if (label.project_id === projectId) delete labelStore.labelMap[id];
            }
            for (const state of states) stateStore.stateMap[state.id] = state;
            for (const label of labels) labelStore.labelMap[label.id] = label;
            for (const member of members)
              memberRoot.memberMap[member.member.id] = { ...member.member, joining_date: member.created_at };
          });
        } catch (error) {
          if (!valid()) {
            throw new DOMException("Detail synchronization superseded", "AbortError");
          }
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status === 403 || status === 404) revoke();
          else throw error;
        }
      },
    });
    return () => {
      active = false;
      abort();
      unsubscribe();
    };
  }, [enabled, workspace, projectId, issueId, rootIssueStore, isArchived]);
}
