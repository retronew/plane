import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EIssuesStoreType } from "@plane/types";
import type { SyncRefreshContext } from "@/lib/sync/engine";
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
  const requestGeneration = useRef(0);
  const disposeSubscription = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      requestGeneration.current++;
      disposeSubscription.current?.();
      disposeSubscription.current = undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Route changes invalidate pending responses and dispose the previous route subscription.
    [routeKey]
  );
  const [fetched, setFetched] = useState<{ routeKey: string; viewId?: string }>();
  useEffect(() => {
    if (!fetched || fetched.routeKey !== routeKey || !workspace) return;
    const { viewId } = fetched;
    const scope =
      storeType === EIssuesStoreType.PROFILE ? user : storeType === EIssuesStoreType.GLOBAL ? globalView : project;
    if (!scope) return;
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
    // Pagination and filters belong only to the concrete store's latest view.
    const activeStore = issues as typeof issues & { requestEntity?: string; controller: AbortController };
    const refresh = (
      issues as unknown as {
        fetchIssuesWithExistingPagination: (
          workspace: string,
          scope: string,
          loadOrView: string,
          viewOrLoad?: string | boolean,
          refreshLoadedRange?: boolean | SyncRefreshContext,
          context?: SyncRefreshContext
        ) => Promise<unknown>;
      }
    ).fetchIssuesWithExistingPagination;
    const unsubscribeMutation = onIssueSyncMutation(() => activeStore.controller.abort());
    const unsubscribe = issueSync.subscribe({
      key: JSON.stringify(["list", storeType, entity]),
      projectId: storeType === EIssuesStoreType.PROFILE || storeType === EIssuesStoreType.GLOBAL ? undefined : project,
      abort: () => activeStore.controller.abort(),
      refresh: async (context) => {
        if (activeStore.requestEntity !== entity) return;
        switch (storeType) {
          case EIssuesStoreType.CYCLE:
          case EIssuesStoreType.MODULE:
            if (viewId) return refresh(workspace, scope, "mutation", viewId, true, context);
            return;
          case EIssuesStoreType.PROJECT_VIEW:
            if (viewId) return refresh(workspace, scope, viewId, "mutation", true, context);
            return;
          default:
            if ("fetchIssuesWithExistingPagination" in issues)
              return refresh(workspace, scope, "mutation", true, context);
        }
      },
    });
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      unsubscribeMutation();
    };
    disposeSubscription.current = dispose;
    return dispose;
  }, [fetched, routeKey, workspace, project, user, globalView, storeType, issues]);

  const fetchIssues = useCallback<IssueActions["fetchIssues"]>(
    async (loadType, options, viewId) => {
      const needsView = [
        EIssuesStoreType.CYCLE,
        EIssuesStoreType.MODULE,
        EIssuesStoreType.PROJECT_VIEW,
        EIssuesStoreType.PROFILE,
      ].includes(storeType);
      const scope =
        storeType === EIssuesStoreType.PROFILE ? user : storeType === EIssuesStoreType.GLOBAL ? globalView : project;
      const generation = ++requestGeneration.current;
      disposeSubscription.current?.();
      disposeSubscription.current = undefined;
      setFetched(undefined);
      const response = await actions.fetchIssues(loadType, options, viewId);
      if (
        generation === requestGeneration.current &&
        response !== undefined &&
        workspace &&
        scope &&
        storeType !== EIssuesStoreType.WORKSPACE_DRAFT &&
        (!needsView || viewId)
      )
        setFetched({ routeKey, viewId });
      return response;
    },
    [actions, workspace, project, user, globalView, storeType, routeKey]
  );
  return { ...actions, fetchIssues };
}
