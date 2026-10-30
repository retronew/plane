import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { LIVE_URL } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
import type { PlateCollaborationConfig } from "@plane/editor/plate";
import { useTranslation } from "@plane/i18n";
import { getDescriptionPlaceholderI18n, getFileURL } from "@plane/utils";
import { RichTextEditor } from "@/components/editor/rich-text";
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser } from "@/hooks/store/user";
import { IssueCollaborationService } from "@/services/issue/issue-collaboration.service";
import { WorkspaceService } from "@/services/workspace.service";
import type { DescriptionInputProps } from "./root";
import { DescriptionInputLoader } from "./loader";

type PlateCollaborationStatus = Parameters<NonNullable<PlateCollaborationConfig["onStatusChange"]>>[0];

const service = new IssueCollaborationService();
const workspaceService = new WorkspaceService();

export const CollaborativeDescriptionInput = observer(function CollaborativeDescriptionInput(
  props: DescriptionInputProps & { projectId: string }
) {
  const { workspaceSlug, projectId, entityId, setIsSubmitting } = props;
  const { t } = useTranslation();
  const { data: user } = useUser();
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const localRef = useRef<EditorRefApi | null>(null);
  const editorRef = props.editorRef ?? localRef;
  const [status, setStatus] = useState<PlateCollaborationStatus>("connecting");
  const [saveError, setSaveError] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [fenced, setFenced] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { fetchIssue } = useIssueDetail();
  const refreshContext = useRef({ fetchIssue, workspaceSlug, projectId, entityId });
  useLayoutEffect(() => {
    refreshContext.current = { fetchIssue, workspaceSlug, projectId, entityId };
  }, [fetchIssue, workspaceSlug, projectId, entityId]);
  const refreshRunning = useRef(false);
  const refreshQueued = useRef(false);
  const refreshSavedIssue = useCallback(async () => {
    refreshQueued.current = true;
    if (refreshRunning.current) return;
    refreshRunning.current = true;
    try {
      while (refreshQueued.current && mounted.current) {
        refreshQueued.current = false;
        const context = refreshContext.current;
        try {
          // oxlint-disable-next-line no-await-in-loop -- Serialize refreshes so an older response cannot overwrite the latest saved issue.
          await context.fetchIssue(context.workspaceSlug, context.projectId, context.entityId);
        } catch (error) {
          console.error("Failed to refresh saved collaborative description", error);
        }
      }
    } finally {
      refreshRunning.current = false;
    }
  }, []);
  const submittingRef = useRef(setIsSubmitting);
  useLayoutEffect(() => {
    submittingRef.current = setIsSubmitting;
  }, [setIsSubmitting]);
  const { data, error, mutate } = useSWR(
    ["issue-description-collaboration", workspaceSlug, projectId, entityId],
    () => service.retrieve(workspaceSlug, projectId, entityId),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false }
  );
  const workspace = getWorkspaceBySlug(workspaceSlug);
  const onStateless = useCallback(
    (payload: string) => {
      let message: unknown;
      try {
        message = JSON.parse(payload);
      } catch {
        return;
      }
      if (!message || typeof message !== "object" || !("type" in message) || typeof message.type !== "string") return;
      if (message.type === "pending") submittingRef.current("submitting");
      if (message.type === "saved") {
        setSaveError(false);
        submittingRef.current("submitted");
        void refreshSavedIssue();
      }
      if (message.type === "save-error") setSaveError(true);
      if (message.type === "fenced") {
        setFenced(true);
        setSaveError(true);
      }
    },
    [refreshSavedIssue]
  );
  const epoch = data?.epoch;
  const userId = user?.id;
  const userName = user?.display_name || user?.first_name || userId;
  const userAvatar = user?.avatar_url;
  const collaboration = useMemo<PlateCollaborationConfig | undefined>(() => {
    if (epoch === undefined || !userId) return undefined;
    const url = new URL(`${LIVE_URL.replace(/\/$/, "")}/issue-description/collaboration`, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return {
      url: url.toString(),
      name: `plate-issue:v1:${workspaceSlug}:${projectId}:${entityId}:${epoch}`,
      token: JSON.stringify({ id: userId }),
      user: {
        id: userId,
        name: userName || userId,
        avatar: getFileURL(userAvatar ?? ""),
        color: "#2563eb",
      },
      onStatusChange: setStatus,
      onStateless,
    };
  }, [epoch, userId, userName, userAvatar, workspaceSlug, projectId, entityId, onStateless]);

  const reconnect = async () => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    try {
      // Every replacement can discard local edits, including a transport error.
      // Keep the editor mounted and read-only throughout the asynchronous copy.
      const html = editorRef.current?.getDocument().html;
      if (html === undefined) {
        setCopyError(true);
        return;
      }
      try {
        await navigator.clipboard.writeText(html);
      } catch {
        setCopyError(true);
        return;
      }
      if (!mounted.current) return;
      const refreshed = await service.retrieve(workspaceSlug, projectId, entityId);
      if (!mounted.current) return;
      await mutate(refreshed, { revalidate: false });
      setFenced(false);
      setSaveError(false);
      setCopyError(false);
      setStatus("connecting");
      setGeneration((value) => value + 1);
    } catch {
      setSaveError(true);
    } finally {
      reconnectingRef.current = false;
      setReconnecting(false);
    }
  };
  if (error && !data)
    return (
      <div role="alert" className="space-y-2 p-3 text-13 text-danger-primary">
        <p>{t("editor_collaboration.load_error")}</p>
        <Button
          size="sm"
          stretch="auto"
          variant="secondary"
          label={t("editor_comparison.retryConnection")}
          onClick={() => void mutate()}
        />
      </div>
    );
  if (!data || !workspace || !collaboration) return <DescriptionInputLoader />;
  return (
    <div className="space-y-2">
      <RichTextEditor
        key={`${entityId}:${data.epoch}:${generation}`}
        ref={editorRef}
        id={entityId}
        editable={!props.disabled && data.can_read && data.can_edit && !fenced && !reconnecting}
        collaboration={collaboration}
        initialValue={data.description_html ?? props.initialValue ?? "<p></p>"}
        workspaceSlug={workspaceSlug}
        workspaceId={workspace.id}
        projectId={projectId}
        issueSequenceId={props.issueSequenceId}
        disabledExtensions={props.disabledExtensions}
        containerClassName={props.containerClassName}
        dragDropEnabled
        placeholder={props.placeholder ?? ((focused, value) => t(getDescriptionPlaceholderI18n(focused, value)))}
        searchMentionCallback={(payload) =>
          workspaceService.searchEntity(workspaceSlug, { ...payload, project_id: projectId })
        }
        uploadFile={async (blockId, file) =>
          (
            await uploadEditorAsset({
              blockId,
              data: { entity_identifier: entityId, entity_type: props.fileAssetType },
              file,
              projectId,
              workspaceSlug,
            })
          ).asset_id
        }
        duplicateFile={async (assetId) =>
          (await duplicateEditorAsset({ assetId, entityType: props.fileAssetType, projectId, workspaceSlug })).asset_id
        }
      />
      {(saveError || fenced || status === "error" || copyError) && (
        <div className="rounded-lg border border-subtle-1 bg-surface-1 p-3 text-13 text-danger-primary">
          {(saveError || fenced || status === "error") && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
              <span>{t(fenced ? "editor_collaboration.conflict" : "editor_collaboration.save_error")}</span>
              <Button
                size="sm"
                stretch="auto"
                variant="secondary"
                label={t("editor_collaboration.copy_reconnect")}
                disabled={reconnecting}
                onClick={() => void reconnect()}
              />
            </div>
          )}
          {copyError && (
            <p role="alert" className="mt-2">
              {t("editor_collaboration.copy_error")}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
