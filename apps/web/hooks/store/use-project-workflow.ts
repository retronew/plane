import { useContext, useEffect } from "react";
import { useParams } from "react-router";
import { StoreContext } from "@/lib/store-context";

export function useProjectWorkflowStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useProjectWorkflow must be used within StoreProvider");
  return context.workflow;
}

export function useProjectWorkflow(projectId?: string) {
  const store = useProjectWorkflowStore();
  const { workspaceSlug } = useParams();
  useEffect(() => {
    if (workspaceSlug && projectId) {
      void store
        .fetchList(workspaceSlug, projectId)
        .then((list) => {
          // Only fall back to the default endpoint when the list lacks an explicit default workflow.
          if (!list.results.some((item) => item.is_default)) {
            return store.fetch(workspaceSlug, projectId);
          }
          return undefined;
        })
        .catch(() => undefined);
      void store.fetchTypes(workspaceSlug, projectId).catch(() => undefined);
    }
  }, [workspaceSlug, projectId, store]);
  return store;
}
