import { useContext, useEffect } from "react";
import { observer } from "mobx-react";
import { API_BASE_URL, LIVE_URL } from "@plane/constants";
import { StoreContext } from "@/lib/store-context";
import { issueSync } from "@/lib/sync/issue-sync";
import { clearRevokedIssues } from "@/lib/sync/clear-issues";

import { APIService } from "@/services/api.service";
import { ReplayCoordinator, type ReplayPage } from "@/lib/sync/replay";
class ReplayAPI extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
}
const replayAPI = new ReplayAPI();

/** Each recurring task owns its timer and exposes the matching disposer. */
function startInterval(callback: () => void, delay: number) {
  const timer = setInterval(callback, delay);
  return () => clearInterval(timer);
}

function defer(callback: () => void) {
  const timer = setTimeout(callback, 0);
  return () => clearTimeout(timer);
}

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
    const replay = new ReplayCoordinator(issueSync, async (cursor, signal) => {
      try {
        return (
          await replayAPI.get(`/api/workspaces/${encodeURIComponent(workspaceSlug)}/sync/changes/`, {
            params: { ...(cursor === undefined ? {} : { cursor }), limit: 100 },
            signal,
          })
        ).data as ReplayPage;
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (!signal.aborted && (status === 401 || status === 403 || status === 404)) issueSync.denyAccess();
        throw error;
      }
    });
    issueSync.setReplay(replay.wake);
    if (document.hidden || !navigator.onLine) issueSync.suspend();
    issueSync.connect(url.toString());

    const timers: {
      reconciliation?: () => void;
      editingCheck?: () => void;
      blur?: () => void;
    } = {};
    let pageHidden = false;
    let releaseEditing: (() => void) | undefined;
    const isEditor = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement &&
          !["button", "submit", "checkbox", "radio", "range", "file", "hidden"].includes(target.type)));
    const onInput = (event: Event) => {
      if (isEditor(event.target) && !releaseEditing) {
        releaseEditing = issueSync.pause();
        if (!document.hidden && navigator.onLine && !pageHidden)
          timers.editingCheck = startInterval(releaseInactiveEditor, 250);
      }
    };
    const releaseInactiveEditor = () => {
      if (isEditor(document.activeElement)) return;
      releaseEditing?.();
      releaseEditing = undefined;
      timers.editingCheck?.();
      timers.editingCheck = undefined;
    };
    const onBlur = () => {
      // Let onBlur save handlers acquire their mutation hold before resuming.
      timers.blur?.();
      if (!document.hidden && navigator.onLine && !pageHidden) timers.blur = defer(releaseInactiveEditor);
    };
    const stopTimers = () => {
      timers.reconciliation?.();
      timers.reconciliation = undefined;
      timers.editingCheck?.();
      timers.editingCheck = undefined;
      timers.blur?.();
    };
    const onVisibility = () => {
      if (document.hidden || !navigator.onLine || pageHidden) {
        stopTimers();
        replay.suspend();
        issueSync.suspend();
      } else {
        releaseInactiveEditor();
        issueSync.resume();
        replay.resume();
        if (!timers.reconciliation) timers.reconciliation = startInterval(replay.wake, 30000);
        if (releaseEditing && !timers.editingCheck) timers.editingCheck = startInterval(releaseInactiveEditor, 250);
      }
    };
    const onPageHide = () => {
      pageHidden = true;
      onVisibility();
    };
    const onPageShow = () => {
      pageHidden = false;
      onVisibility();
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    window.addEventListener("offline", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    onVisibility();

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
      window.removeEventListener("offline", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      timers.reconciliation?.();
      timers.editingCheck?.();
      timers.blur?.();
      unsubscribeAccess();
      replay.dispose();
      issueSync.setReplay(undefined);
      issueSync.disconnect();
      releaseEditing?.();
    };
  }, [workspaceSlug, userId, store.issue]);

  return null;
});
