// oxlint-disable jsx_a11y/prefer-tag-over-role
// oxlint-disable jsx_a11y/click-events-have-key-events
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEvent, MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { ETabIndices } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { DialogActions, DialogBody, DialogInfo, DialogMain, DialogTitle } from "@makeplane/propel/components/dialog";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { ChevronRight, X } from "lucide-react";
import { useProject } from "@/hooks/store/use-project";
import { setToast } from "@plane/blocks/toast";
import type { TIssue } from "@plane/types";
import { Switch } from "@makeplane/propel/components/switch";
import { renderFormattedPayloadDate, getTabIndex } from "@plane/utils";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { FileService } from "@/services/file.service";
// local imports
import { InboxIssueDescription } from "./issue-description";
import { InboxIssueProperties } from "./issue-properties";
import { InboxIssueTitle } from "./issue-title";
import {
  hasComposerContent,
  readComposerDraft,
  saveComposerDraft,
} from "@/components/issues/issue-modal/composer-cache";
import { prepareComposerMotion } from "@/components/issues/issue-modal/composer-motion";

const fileService = new FileService();

type TInboxIssueCreateRoot = {
  workspaceSlug: string;
  projectId: string;
  handleModalClose: () => void;
  cacheKey?: string;
  popupRef: MutableRefObject<HTMLDivElement | null>;
  triggerSelector: string;
  closeRequestRef: MutableRefObject<(() => void) | null>;
};

export const defaultIssueData: Partial<TIssue> = {
  id: undefined,
  name: "",
  description_html: "",
  priority: "none",
  state_id: "",
  label_ids: [],
  assignee_ids: [],
  start_date: renderFormattedPayloadDate(new Date()),
  target_date: "",
};

export const InboxIssueCreateRoot = observer(function InboxIssueCreateRoot(props: TInboxIssueCreateRoot) {
  const { workspaceSlug, projectId, handleModalClose, closeRequestRef, cacheKey, popupRef, triggerSelector } = props;
  const [cachedDraft] = useState(() => (cacheKey ? readComposerDraft(cacheKey) : undefined));
  // states
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>(cachedDraft?.assetIds ?? []);
  // router
  const router = useAppRouter();
  // refs
  const descriptionEditorRef = useRef<EditorRefApi>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // hooks
  const { createInboxIssue } = useProjectInbox();
  const { getWorkspaceBySlug } = useWorkspace();
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);
  // states
  const [createMore, setCreateMore] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<TIssue>>(() => ({ ...defaultIssueData, ...cachedDraft?.values }));
  const handleFormData = useCallback(
    <T extends keyof Partial<TIssue>>(issueKey: T, issueValue: Partial<TIssue>[T]) => {
      setFormData({
        ...formData,
        [issueKey]: issueValue,
      });
    },
    [formData]
  );

  const { getIndex } = getTabIndex(ETabIndices.INTAKE_ISSUE_FORM, isMobile);

  const requestClose = useCallback(() => {
    if (formSubmitting) return;
    if (descriptionEditorRef.current?.isEditorReadyToDiscard()) {
      if (cacheKey) {
        // The default start date is not an edited field in this form.
        const draft = { values: formData, assetIds: uploadedAssetIds };
        const hasContent =
          hasComposerContent({ ...draft, values: { ...formData, start_date: undefined } }) || !!formData.state_id;
        saveComposerDraft(cacheKey, hasContent ? draft : undefined);
        if (hasContent && popupRef.current && prepareComposerMotion(popupRef.current, "new", triggerSelector)) {
          popupRef.current.dataset.minimizing = "true";
        }
      }
      handleModalClose();
    } else {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.editor_is_still_processing_changes_please_wait_before_procee"),
      });
    }
  }, [formSubmitting, handleModalClose, t, cacheKey, formData, uploadedAssetIds, popupRef, triggerSelector]);

  useEffect(() => {
    closeRequestRef.current = requestClose;
    return () => {
      closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestClose]);

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formSubmitting || !formData.name?.trim() || formData.name.length > 255) return;

    if (!descriptionEditorRef.current?.isEditorReadyToDiscard()) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.editor_is_still_processing_changes_please_wait_before_procee"),
      });
      return;
    }

    const payload: Partial<TIssue> = {
      name: formData.name || "",
      description_html: formData.description_html || "<p></p>",
      priority: formData.priority || "none",
      state_id: formData.state_id || "",
      label_ids: formData.label_ids || [],
      assignee_ids: formData.assignee_ids || [],
      target_date: formData.target_date || null,
    };
    setFormSubmitting(true);

    await createInboxIssue(workspaceSlug, projectId, payload)
      // oxlint-disable-next-line promise/always-return
      .then(async (res) => {
        if (uploadedAssetIds.length > 0) {
          await fileService.updateBulkProjectAssetsUploadStatus(workspaceSlug, projectId, res?.issue.id ?? "", {
            asset_ids: uploadedAssetIds,
          });
          setUploadedAssetIds([]);
        }
        if (cacheKey) saveComposerDraft(cacheKey);
        if (!createMore) {
          router.push(`/${workspaceSlug}/projects/${projectId}/intake/?currentTab=open&inboxIssueId=${res?.issue?.id}`);
          handleModalClose();
        } else {
          descriptionEditorRef?.current?.clearEditor();
          setFormData(defaultIssueData);
        }
        setToast({
          type: "success",
          title: t("web.success_2"),
          message: t("web.runtime.intake_request_submitted"),
        });
      })
      .catch((error) => {
        console.error(error);
        setToast({
          type: "error",
          title: t("web.error_2"),
          message: t("web.some_error_occurred_please_try_again"),
        });
      })
      .finally(() => {
        setFormSubmitting(false);
      });
  };

  const isTitleLengthMoreThan255Character = formData?.name ? formData.name.length > 255 : false;

  if (!workspaceSlug || !projectId || !workspaceId) return <></>;
  return (
    // The dialog popup is the card (surface, border, radius, shadow), so this tree no longer draws
    // the rounded/background chrome it needed inside the transparent legacy modal.
    <div className="flex min-h-0 w-full flex-1 gap-2">
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <form ref={formRef} onSubmit={handleFormSubmit} className="flex min-h-0 w-full flex-1 flex-col">
          <DialogMain render={<div className="issue-composer-main" />}>
            <div className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate rounded-lg border border-subtle-1 px-2 py-1 text-body-xs-medium text-secondary">
                  {project?.name}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-placeholder" aria-hidden="true" />
                <DialogTitle data-composer-heading="">{t("web.runtime.intake_submit_request")}</DialogTitle>
              </div>
              <IconButton
                variant="ghost"
                size="md"
                icon={<X className="size-4" />}
                aria-label={t("close")}
                onClick={requestClose}
                disabled={formSubmitting}
              />
            </div>
            <div className="shrink-0 pt-2">
              <InboxIssueTitle
                data={formData}
                handleData={handleFormData}
                isTitleLengthMoreThan255Character={isTitleLengthMoreThan255Character}
              />
            </div>
            <DialogBody tabIndex={0} render={<div className="vertical-scrollbar scrollbar-sm [&>div]:w-auto" />}>
              <InboxIssueDescription
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                workspaceId={workspaceId}
                data={formData}
                handleData={handleFormData}
                editorRef={descriptionEditorRef}
                containerClassName="issue-composer-editor min-h-[150px] border-0 bg-transparent"
                onEnterKeyPress={() => submitBtnRef?.current?.click()}
                onAssetUpload={(assetId) => setUploadedAssetIds((prev) => [...prev, assetId])}
              />
            </DialogBody>
            <div className="shrink-0" data-composer-pill-group="">
              <InboxIssueProperties
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                data={formData}
                handleData={handleFormData}
              />
            </div>
          </DialogMain>
          <DialogActions render={<div className="issue-composer-actions" />}>
            <DialogInfo>
              {/* A label (not a role="button" div) so clicking the switch or the text toggles once. */}
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <Switch
                  size="md"
                  checked={createMore}
                  onCheckedChange={() => setCreateMore((prevData) => !prevData)}
                  tabIndex={getIndex("create_more")}
                  aria-label={t("create_more")}
                />
                <span className="text-11">{t("create_more")}</span>
              </label>
            </DialogInfo>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              type="button"
              onClick={requestClose}
              disabled={formSubmitting}
              tabIndex={getIndex("discard_button")}
              label={t("web.runtime.intake_save_for_later")}
            />
            <Button
              variant="primary"
              ref={submitBtnRef}
              type="submit"
              loading={formSubmitting}
              disabled={isTitleLengthMoreThan255Character || !formData.name?.trim()}
              tabIndex={getIndex("submit_button")}
              size="md"
              stretch="auto"
              label={
                formSubmitting ? t("web.runtime.intake_submitting_request") : t("web.runtime.intake_submit_request")
              }
            />
          </DialogActions>
        </form>
      </div>
    </div>
  );
});
