/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect } from "react";
import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { AiStar1Outline } from "@makeplane/propel/icons";
// plane imports
import { ETabIndices } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TIssue } from "@plane/types";
import { EFileAssetType } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
import { getDescriptionPlaceholderI18n, getTabIndex } from "@plane/utils";
// components
import { GptAssistantPopover } from "@/components/core/modals/gpt-assistant-popover";
import { RichTextEditor } from "@/components/editor/rich-text";
// helpers
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useInstance } from "@/hooks/store/use-instance";
import { useWorkspace } from "@/hooks/store/use-workspace";
import useKeypress from "@/hooks/use-keypress";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web services
import { WorkspaceService } from "@/services/workspace.service";
// services
const workspaceService = new WorkspaceService();

type TIssueDescriptionEditorProps = {
  control: Control<TIssue>;
  isDraft: boolean;
  issueName: string;
  issueId: string | undefined;
  descriptionHtmlData: string | undefined;
  editorRef: React.MutableRefObject<EditorRefApi | null>;
  submitBtnRef: React.MutableRefObject<HTMLButtonElement | null>;
  gptAssistantModal: boolean;
  workspaceSlug: string;
  projectId: string | null;
  handleFormChange: () => void;
  handleDescriptionHTMLDataChange: (descriptionHtmlData: string) => void;
  setGptAssistantModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleGptAssistantClose: () => void;
  onAssetUpload: (assetId: string) => void;
  onClose: () => void;
};

export const IssueDescriptionEditor = observer(function IssueDescriptionEditor(props: TIssueDescriptionEditorProps) {
  const {
    control,
    isDraft,
    issueName,
    issueId,
    descriptionHtmlData,
    editorRef,
    submitBtnRef,
    gptAssistantModal,
    workspaceSlug,
    projectId,
    handleFormChange,
    handleDescriptionHTMLDataChange,
    setGptAssistantModal,
    handleGptAssistantClose,
    onAssetUpload,
    onClose,
  } = props;
  // i18n
  const { t } = useTranslation();
  // states
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  const workspaceId = getWorkspaceBySlug(workspaceSlug?.toString())?.id ?? "";
  const { config } = useInstance();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  // platform
  const { isMobile } = usePlatformOS();

  const { getIndex } = getTabIndex(ETabIndices.ISSUE_FORM, isMobile);

  useEffect(() => {
    if (descriptionHtmlData) handleDescriptionHTMLDataChange(descriptionHtmlData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptionHtmlData]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (gptAssistantModal) return;
    if (editorRef.current?.isEditorReadyToDiscard()) {
      onClose();
    } else {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.editor_is_still_processing_changes_please_wait_before_procee"),
      });
      event.preventDefault(); // Prevent default action if editor is not ready to discard
    }
  };

  useKeypress("Escape", handleKeyDown);

  return (
    <div className="issue-composer-description relative">
      {descriptionHtmlData === undefined || !projectId ? (
        <Loader className="max-h-64 min-h-[120px] space-y-2 overflow-hidden rounded-md border border-subtle p-3 py-2 pt-3">
          <Loader.Item width="100%" height="26px" />
          <div className="flex items-center gap-2">
            <Loader.Item width="26px" height="26px" />
            <Loader.Item width="400px" height="26px" />
          </div>
          <div className="flex items-center gap-2">
            <Loader.Item width="26px" height="26px" />
            <Loader.Item width="400px" height="26px" />
          </div>
          <Loader.Item width="80%" height="26px" />
          <div className="flex items-center gap-2">
            <Loader.Item width="50%" height="26px" />
          </div>
          <div className="border-0.5 absolute right-3.5 bottom-2 z-10 flex items-center gap-2">
            <Loader.Item width="100px" height="26px" />
            <Loader.Item width="50px" height="26px" />
          </div>
        </Loader>
      ) : (
        <>
          <Controller
            name="description_html"
            control={control}
            render={({ field: { value, onChange } }) => (
              <RichTextEditor
                editable
                id="issue-modal-editor"
                initialValue={value ?? ""}
                value={descriptionHtmlData}
                workspaceSlug={workspaceSlug?.toString()}
                workspaceId={workspaceId}
                projectId={projectId}
                onChange={(_description: object, description_html: string) => {
                  onChange(description_html);
                  handleFormChange();
                }}
                onEnterKeyPress={() => submitBtnRef?.current?.click()}
                ref={editorRef}
                tabIndex={getIndex("description_html")}
                placeholder={(isFocused, description) => t(getDescriptionPlaceholderI18n(isFocused, description))}
                searchMentionCallback={async (payload) =>
                  await workspaceService.searchEntity(workspaceSlug?.toString() ?? "", {
                    ...payload,
                    project_id: projectId?.toString() ?? "",
                  })
                }
                containerClassName="issue-composer-editor min-h-[84px]"
                uploadFile={async (blockId, file) => {
                  try {
                    const { asset_id } = await uploadEditorAsset({
                      blockId,
                      data: {
                        entity_identifier: issueId ?? "",
                        entity_type: isDraft
                          ? EFileAssetType.DRAFT_ISSUE_DESCRIPTION
                          : EFileAssetType.ISSUE_DESCRIPTION,
                      },
                      file,
                      projectId,
                      workspaceSlug,
                    });
                    onAssetUpload(asset_id);
                    return asset_id;
                  } catch (error) {
                    console.log("Error in uploading issue asset:", error);
                    throw new Error("Asset upload failed. Please try again later.", { cause: error });
                  }
                }}
                duplicateFile={async (assetId: string) => {
                  try {
                    const { asset_id } = await duplicateEditorAsset({
                      assetId,
                      entityId: issueId,
                      entityType: isDraft ? EFileAssetType.DRAFT_ISSUE_DESCRIPTION : EFileAssetType.ISSUE_DESCRIPTION,
                      projectId,
                      workspaceSlug,
                    });
                    onAssetUpload(asset_id);
                    return asset_id;
                  } catch {
                    throw new Error("Asset duplication failed. Please try again later.");
                  }
                }}
              />
            )}
          />
          <div className="z-10 flex items-center justify-end gap-2 pt-1">
            {config?.has_llm_configured && getWorkspaceBySlug(workspaceSlug)?.ai_enabled !== false && projectId && (
              <GptAssistantPopover
                isOpen={gptAssistantModal}
                handleClose={() => {
                  setGptAssistantModal((prevData) => !prevData);
                  // this is done so that the title do not reset after gpt popover closed
                  handleGptAssistantClose();
                }}
                getContext={() => ({
                  kind: "issue",
                  title: issueName,
                  document: editorRef.current?.getDocument().html ?? "",
                })}
                onApply={(html, mode, context) => {
                  const editor = editorRef.current;
                  if (!editor || context.title !== issueName || editor.getDocument().html !== context.document)
                    return false;
                  editor.setEditorValue(mode === "replace" ? html : context.document + html, true);
                  return true;
                }}
                onUndo={(context) => editorRef.current?.setEditorValue(context.document, true)}
                placement="top-end"
                button={
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-1 text-caption-sm-regular hover:bg-layer-1"
                    onClick={() => setGptAssistantModal((prevData) => !prevData)}
                    tabIndex={-1}
                  >
                    <AiStar1Outline className="h-4 w-4" />
                    {t("web.ai_writing_title")}
                  </button>
                }
                workspaceSlug={workspaceSlug}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
});
