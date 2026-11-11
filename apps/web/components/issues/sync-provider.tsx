import { useContext, useEffect } from "react";
import { observer } from "mobx-react";
import { LIVE_URL } from "@plane/constants";
import { StoreContext } from "@/lib/store-context";
import { issueSync } from "@/lib/sync/issue-sync";
import { clearRevokedIssues } from "@/lib/sync/clear-issues";

/** One connection per authenticated workspace, shared by all mounted issue views. */
export const IssueSyncProvider = observer(function IssueSyncProvider() {
  const store = useContext(StoreContext);
  const workspaceSlug = store.router.workspaceSlug;
  const userId = store.user.data?.id;

  useEffect(() => {
    if (!workspaceSlug || !userId) return;
    const url = new URL(
      `${LIVE_URL.replace(/\/$/, "")}/sync/workspaces/${encodeURIComponent(workspaceSlug)}`,
      window.location.origin
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const unsubscribeAccess = issueSync.subscribe({
      key: JSON.stringify(["workspace-access", workspaceSlug, userId]),
      refresh: () => Promise.resolve(),
      onAccessRevoked: (projectId) => clearRevokedIssues(store.issue, projectId),
    });
    issueSync.connect(url.toString());

    let releaseVisibility: (() => void) | undefined;
    let releaseEditing: (() => void) | undefined;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const isEditor = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement &&
          !["button", "submit", "checkbox", "radio", "range", "file", "hidden"].includes(target.type)));
    const onInput = (event: Event) => {
      if (isEditor(event.target) && !releaseEditing) releaseEditing = issueSync.pause();
    };
    const onBlur = () => {
      // Let onBlur save handlers acquire their mutation hold before resuming.
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (isEditor(document.activeElement)) return;
        releaseEditing?.();
        releaseEditing = undefined;
      }, 0);
    };
    const onVisibility = () => {
      if (document.hidden) releaseVisibility ??= issueSync.pause();
      else {
        releaseVisibility?.();
        releaseVisibility = undefined;
        issueSync.invalidate();
      }
    };
    const onOnline = () => issueSync.invalidate();
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    onVisibility();
    // Pub/Sub is deliberately ephemeral. Periodic reconciliation covers missed
    // notifications, Redis interruptions and background/bulk write paths.
    const reconciliation = setInterval(() => {
      if (!document.hidden && navigator.onLine) issueSync.invalidate();
    }, 30000);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clearInterval(reconciliation);
      clearTimeout(blurTimer);
      unsubscribeAccess();
      issueSync.disconnect();
      releaseEditing?.();
      releaseVisibility?.();
    };
  }, [workspaceSlug, userId, store.issue]);

  return null;
});
