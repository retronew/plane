import { useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { EIssuesStoreType } from "@plane/types";
import { issueSync } from "@/lib/sync/issue-sync";
import { onIssueSyncMutation } from "@/services/issue-sync-mutation";
import { useIssues } from "./store/use-issues";
import type { IssueActions } from "./use-issues-actions";

export function useIssueListSync(storeType: EIssuesStoreType, actions: IssueActions): IssueActions {
  const params = useParams();
  const workspace = params.workspaceSlug?.toString();
  const project = params.projectId?.toString();
  const user = params.userId?.toString();
  const globalView = params.globalViewId?.toString();
  const { issues } = useIssues(storeType);
  const routeKey = JSON.stringify([
    workspace,
    project,
    user,
    globalView,
    params.cycleId,
    params.moduleId,
    params.viewId,
    storeType,
  ]);
  const subscription = useRef<{ key: string; dispose?: () => void }>({ key: routeKey });
  useEffect(() => {
    const owner: { key: string; dispose?: () => void } = { key: routeKey };
    subscription.current = owner;
    return () => {
      owner.dispose?.();
    };
  }, [routeKey]);

  const fetchIssues = useCallback<IssueActions["fetchIssues"]>(
    async (loadType, options, viewId) => {
      if (!workspace || storeType === EIssuesStoreType.WORKSPACE_DRAFT)
        return actions.fetchIssues(loadType, options, viewId);
      if (
        [
          EIssuesStoreType.CYCLE,
          EIssuesStoreType.MODULE,
          EIssuesStoreType.PROJECT_VIEW,
          EIssuesStoreType.PROFILE,
        ].includes(storeType) &&
        !viewId
      )
        return actions.fetchIssues(loadType, options, viewId);
      const scope =
        storeType === EIssuesStoreType.PROFILE ? user : storeType === EIssuesStoreType.GLOBAL ? globalView : project;
      if (!scope) return actions.fetchIssues(loadType, options, viewId);
      const entity = JSON.stringify([
        workspace,
        scope,
        ...([
          EIssuesStoreType.CYCLE,
          EIssuesStoreType.MODULE,
          EIssuesStoreType.PROJECT_VIEW,
          EIssuesStoreType.PROFILE,
        ].includes(storeType)
          ? [viewId]
          : []),
      ]);
      subscription.current.dispose?.();
      // The concrete stores expose requestEntity at runtime. Compare it before
      // refreshing: their pagination/filter state belongs only to the latest view.
      const activeStore = issues as typeof issues & { requestEntity?: string; controller: AbortController };
      const refresh = (
        issues as unknown as {
          fetchIssuesWithExistingPagination: (
            workspace: string,
            scope: string,
            loadOrView: string,
            viewOrLoad?: string
          ) => Promise<unknown>;
        }
      ).fetchIssuesWithExistingPagination;
      const unsubscribeMutation = onIssueSyncMutation(() => activeStore.controller?.abort());
      const unsubscribe = issueSync.subscribe({
        key: JSON.stringify(["list", storeType, entity]),
        projectId:
          storeType === EIssuesStoreType.PROFILE || storeType === EIssuesStoreType.GLOBAL ? undefined : project,
        refresh: async () => {
          if (activeStore.requestEntity !== entity) return;
          switch (storeType) {
            case EIssuesStoreType.CYCLE:
            case EIssuesStoreType.MODULE:
              if (viewId) return refresh(workspace, scope, "mutation", viewId);
              return;
            case EIssuesStoreType.PROJECT_VIEW:
              if (viewId) return refresh(workspace, scope, viewId, "mutation");
              return;
            default:
              if ("fetchIssuesWithExistingPagination" in issues) return refresh(workspace, scope, "mutation");
          }
        },
      });
      subscription.current.dispose = () => {
        unsubscribe();
        unsubscribeMutation();
      };
      return actions.fetchIssues(loadType, options, viewId);
    },
    [actions, workspace, project, user, globalView, storeType, issues]
  );
  return { ...actions, fetchIssues };
}
