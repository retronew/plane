import { useCallback, useMemo, useState, useRef, useLayoutEffect } from "react";
import useSWR from "swr";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { LIVE_URL } from "@plane/constants";
import type { EditorRefApi, TUserDetails } from "@plane/editor";
import type { PlateCollaborationConfig } from "@plane/editor/plate";
import { PageCollaborationService } from "@/services/page/page-collaboration.service";
import type { TPageInstance } from "@/store/pages/base-page";
import type { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";
import { dispatchPageEvent } from "./page-events";
const collaborationService = new PageCollaborationService();
export function usePageCollaboration({
  page,
  projectId,
  workspaceSlug,
  editorForwardRef,
  userConfig,
  updatePageProperties,
}: {
  page: TPageInstance;
  projectId?: string;
  workspaceSlug: string;
  editorForwardRef: React.RefObject<EditorRefApi | null>;
  userConfig: TUserDetails;
  updatePageProperties: ReturnType<typeof useRealtimePageEvents>["updatePageProperties"];
}) {
  const pageId = page.id;
  const { id: userId, name: userName, avatar: userAvatar, color: userColor } = userConfig;
  const { setSyncingStatus } = page;
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [fenced, setFenced] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [copyError, setCopyError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const {
    data: snapshot,
    error: loadError,
    mutate,
  } = useSWR(
    projectId && pageId ? ["page-collaboration", workspaceSlug, projectId, pageId] : null,
    () => collaborationService.retrieve(workspaceSlug, projectId!, pageId!),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false }
  );
  const onStateless = useCallback(
    (payload: string) => {
      let message: unknown;
      try {
        message = JSON.parse(payload);
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if ("type" in message) {
        if (message.type === "pending") setSyncingStatus("syncing");
        if (message.type === "saved") {
          setSyncingStatus("synced");
          setSaveError(false);
        }
        if (message.type === "save-error" || message.type === "fenced") {
          setSyncingStatus("error");
          setSaveError(true);
          if (message.type === "fenced") setFenced(true);
        }
      }
      // Business events are validated before reaching the page store.
      dispatchPageEvent(message, updatePageProperties);
    },
    [setSyncingStatus, updatePageProperties]
  );

  const epoch = snapshot?.epoch;
  const collaboration = useMemo<PlateCollaborationConfig | undefined>(() => {
    if (epoch === undefined || !userId || !pageId || !projectId || typeof window === "undefined") return undefined;
    const url = new URL(`${LIVE_URL.replace(/\/$/, "")}/page-description/collaboration`, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return {
      url: url.toString(),
      name: `plate-page:v1:${workspaceSlug}:${pageId}:${epoch}`,
      token: JSON.stringify({ id: userId, projectId }),
      user: { id: userId, name: userName, avatar: userAvatar, color: userColor },
      onProvider: setProvider,
      onStateless,
      onStatusChange: (status) => {
        const disconnected = status === "error" || status === "disconnected";
        if (disconnected) {
          setSyncingStatus("error");
          setSaveError(true);
        } else if (status !== "synced") setSyncingStatus("syncing");
      },
    };
  }, [epoch, userId, userName, userAvatar, userColor, pageId, projectId, workspaceSlug, onStateless, setSyncingStatus]);
  const reconnect = async () => {
    if (reconnectingRef.current || !pageId || !projectId) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    try {
      const html = editorForwardRef.current?.getDocument().html;
      if (html === undefined) {
        setCopyError(true);
        return;
      }
      try {
        await navigator.clipboard.writeText(`${provider?.document.getText("title").toString() ?? page.name}\n${html}`);
      } catch {
        if (mounted.current) setCopyError(true);
        return;
      }
      if (!mounted.current) return;
      const refreshed = await collaborationService.retrieve(workspaceSlug, projectId, pageId);
      if (!mounted.current) return;
      await mutate(refreshed, { revalidate: false });
      if (!mounted.current) return;
      setFenced(false);
      setSaveError(false);
      setCopyError(false);
      setSyncingStatus("syncing");
      setGeneration((value) => value + 1);
    } catch {
      if (mounted.current) setSaveError(true);
    } finally {
      reconnectingRef.current = false;
      if (mounted.current) setReconnecting(false);
    }
  };

  return {
    reconnecting,
    provider,
    fenced,
    saveError,
    generation,
    copyError,
    snapshot,
    loadError,
    mutate,
    collaboration,
    reconnect,
  };
}
