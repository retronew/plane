import { useEffect, useRef } from "react";
import type { TIssue } from "@plane/types";
import { issueSync } from "@/lib/sync/issue-sync";
import { APIService } from "@/services/api.service";
import { API_BASE_URL } from "@plane/constants";
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
    const revoke = () => {
      if (!active) return;
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
      ]) {
        list.removeIssueFromList(issueId);
      }
      rootIssueStore.issues.removeIssue(issueId);
      unavailable.current?.();
    };
    const unsubscribe = issueSync.subscribe({
      key: JSON.stringify(["detail", workspace, projectId, issueId, isArchived]),
      projectId,
      onAccessRevoked: revoke,
      refresh: async () => {
        const revision = issueSync.revision;
        try {
          const response = await service.get(
            `/api/workspaces/${workspace}/projects/${projectId}/issues/${issueId}/${isArchived ? "archive/" : ""}`
          );
          if (!active) return;
          if (revision !== issueSync.revision || issueSync.paused) {
            issueSync.invalidate(projectId);
            return;
          }
          const current = rootIssueStore.issues.getIssueById(issueId);
          const {
            description_html: _html,
            description: _description,
            description_binary: _binary,
            ...fields
          } = response.data as TIssue & { description?: unknown; description_binary?: unknown };
          // Preserve collaborative editor state and any existing local description.
          rootIssueStore.issues.addIssue([{ ...current, ...fields } as TIssue]);
        } catch (error) {
          if (!active) return;
          if (revision !== issueSync.revision || issueSync.paused) {
            issueSync.invalidate(projectId);
            return;
          }
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status === 403 || status === 404) revoke();
          else throw error;
        }
      },
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, workspace, projectId, issueId, rootIssueStore, isArchived]);
}
