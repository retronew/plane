// oxlint-disable promise/always-return
// oxlint-disable no-shadow
// oxlint-disable jsx_a11y/prefer-tag-over-role
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TemplatePicker } from "@/components/settings/workspace/configuration/template-picker";
import { getWorkItemTemplatePatch } from "@/components/settings/workspace/configuration/template-application";
import React, { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
// editor
import { ETabIndices, DEFAULT_WORK_ITEM_FORM_VALUES } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
// i18n
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { ChevronRight, X } from "lucide-react";
import { DialogActions, DialogBody, DialogInfo, DialogMain, DialogTitle } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { TIssue, TWorkspaceDraftIssue } from "@plane/types";
// hooks
import { Switch } from "@makeplane/propel/components/switch";
import {
  convertWorkItemDataToSearchResponse,
  getUpdateFormDataForReset,
  getChangedIssuefields,
  getTabIndex,
} from "@plane/utils";
// components
import {
  IssueDefaultProperties,
  IssueDescriptionEditor,
  IssueParentTag,
  IssueProjectSelect,
  IssueTitleInput,
} from "@/components/issues/issue-modal/components";
// helpers
// hooks
import { useIssueModal } from "@/hooks/context/use-issue-modal";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useDefaultIssueType } from "@/hooks/use-default-issue-type";
import { useWorkspaceDraftIssues } from "@/hooks/store/workspace-draft";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useProjectIssueProperties } from "@/hooks/use-project-issue-properties";
import { CustomPropertyFields } from "@/components/issues/custom-properties";
import { customPropertyDefaults, customPropertyPayload } from "@/helpers/custom-properties";
import type { TCustomPropertyValues } from "@/services/project/custom-properties.types";

export interface IssueFormProps {
  data?: Partial<TIssue>;
  issueTitleRef: React.MutableRefObject<HTMLInputElement | null>;
  isCreateMoreToggleEnabled: boolean;
  onAssetUpload: (assetId: string) => void;
  onCreateMoreToggleChange: (value: boolean) => void;
  onChange?: (formData: Partial<TIssue> | null) => void;
  onClose: () => void;
  onDiscard?: () => void;
  onKeepDraft?: (values: Partial<TIssue>, hasChanges: boolean) => void;
  closeRequestRef?: React.MutableRefObject<(() => void) | null>;
  onSubmit: (values: Partial<TIssue>, is_draft_issue?: boolean) => Promise<void>;
  projectId: string;
  isDraft: boolean;
  moveToIssue?: boolean;
  modalTitle?: string;
  primaryButtonText?: {
    default: string;
    loading: string;
  };
  isDuplicateModalOpen: boolean;
  handleDuplicateIssueModal: (isOpen: boolean) => void;
  handleDraftAndClose?: () => void;
  isProjectSelectionDisabled?: boolean;
  showActionButtons?: boolean;
  dataResetProperties?: any[];
}

export const IssueFormRoot = observer(function IssueFormRoot(props: IssueFormProps) {
  const { t } = useTranslation();
  const {
    data,
    issueTitleRef,
    onAssetUpload,
    onChange,
    onClose: closeWithDraftPrompt,
    onKeepDraft,
    closeRequestRef,
    onDiscard,
    onSubmit,
    projectId: defaultProjectId,
    isCreateMoreToggleEnabled,
    onCreateMoreToggleChange,
    isDraft,
    moveToIssue = false,
    modalTitle = `${data?.id ? t("update") : isDraft ? t("create_a_draft") : t("create_new_issue")}`,
    primaryButtonText = {
      default: `${data?.id ? t("update") : isDraft ? t("save_to_drafts") : t("create_new_issue")}`,
      loading: `${data?.id ? t("updating") : t("saving")}`,
    },
    isProjectSelectionDisabled = false,
    showActionButtons = true,
    dataResetProperties = [],
  } = props;

  // states
  const [gptAssistantModal, setGptAssistantModal] = useState(false);
  const [isMoving, setIsMoving] = useState<boolean>(false);

  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // router
  const { workspaceSlug, projectId: routeProjectId } = useParams();

  // store hooks
  const { getProjectById } = useProject();
  const {
    workItemTemplateId,
    isApplyingTemplate,
    selectedParentIssue,
    setWorkItemTemplateId,
    setSelectedParentIssue,
    getIssueTypeIdOnProjectChange,
    handlePropertyValuesValidation,
    handleTemplateChange,
    handleProjectEntitiesFetch,
    customProperties,
    customPropertyValues,
    setCustomPropertyValues,
    customPropertyErrors,
    customPropertiesLoading,
    customPropertiesError,
    customPropertyContext,
    prepareCustomProperties,
    retryCustomProperties,
  } = useIssueModal();
  const { isMobile } = usePlatformOS();
  const { moveIssue } = useWorkspaceDraftIssues();

  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { fetchCycles } = useProjectIssueProperties();
  const { getStateById } = useProjectState();

  // form info
  const methods = useForm<TIssue>({
    defaultValues: { ...DEFAULT_WORK_ITEM_FORM_VALUES, project_id: defaultProjectId, ...data },
    reValidateMode: "onChange",
  });
  const {
    formState,
    formState: { isDirty, isSubmitting, dirtyFields },
    handleSubmit,
    reset,
    watch,
    control,
    getValues,
    setValue,
  } = methods;

  const projectId = watch("project_id");
  const typeId = watch("type_id");
  const slug = workspaceSlug?.toString();
  useEffect(() => {
    void handleProjectEntitiesFetch({
      workItemProjectId: projectId,
      workItemTypeId: typeId ?? undefined,
      workspaceSlug: slug,
      isDraft,
    });
  }, [projectId, typeId, slug, isDraft, handleProjectEntitiesFetch]);
  const savedCustomProperties = (data as (Partial<TIssue> & { custom_properties?: TCustomPropertyValues }) | undefined)
    ?.custom_properties;
  useEffect(() => {
    if (savedCustomProperties) setCustomPropertyValues(savedCustomProperties);
  }, [savedCustomProperties, setCustomPropertyValues]);
  const withCustomProperties = (values: Partial<TIssue>) => ({ ...values, custom_properties: customPropertyValues });
  const workflowStore = useProjectWorkflow(projectId ?? undefined);
  const projectTypes = workflowStore.issueTypes[projectId ?? ""]?.results;

  const onClose = () => {
    if (isSubmitting || isMoving || isApplyingTemplate) return;
    if (!editorRef.current?.isEditorReadyToDiscard()) {
      setToast({ type: "error", title: t("error"), message: t("editor_is_not_ready_to_discard_changes") });
      return;
    }
    if (onKeepDraft && !data?.id) {
      onKeepDraft(withCustomProperties(getValues()), isDirty || Object.keys(customPropertyValues).length > 0);
      return;
    }
    closeWithDraftPrompt();
  };
  useEffect(() => {
    if (!closeRequestRef) return;
    closeRequestRef.current = onClose;
    return () => {
      closeRequestRef.current = null;
    };
  });

  const isDisabled = isSubmitting || isApplyingTemplate;

  const { getIndex } = getTabIndex(ETabIndices.ISSUE_FORM, isMobile);

  //reset few fields on projectId change
  useEffect(() => {
    if (isDirty) {
      if (workItemTemplateId) {
        // reset work item template id
        setWorkItemTemplateId(null);
        reset({ ...DEFAULT_WORK_ITEM_FORM_VALUES, project_id: projectId });
        editorRef.current?.clearEditor();
      } else {
        reset(getUpdateFormDataForReset(projectId, getValues()));
      }
    }
    if (projectId && routeProjectId !== projectId) fetchCycles(workspaceSlug?.toString(), projectId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Reset form when data prop changes
  useEffect(() => {
    if (data) {
      reset({ ...DEFAULT_WORK_ITEM_FORM_VALUES, project_id: projectId, ...data });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dataResetProperties]);

  useDefaultIssueType({
    projectId,
    types: projectTypes,
    data,
    getValues,
    setValue,
    getDefault: getIssueTypeIdOnProjectChange,
  });

  useEffect(() => {
    if (workItemTemplateId && editorRef.current) {
      handleTemplateChange({
        workspaceSlug: workspaceSlug?.toString(),
        reset,
        editorRef,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemTemplateId]);

  const handleFormSubmit = async (formData: Partial<TIssue>, is_draft_issue = false) => {
    // Check if the editor is ready to discard
    if (!editorRef.current?.isEditorReadyToDiscard()) {
      setToast({
        type: "error",
        title: t("error"),
        message: t("editor_is_not_ready_to_discard_changes"),
      });
      return;
    }

    // check for required properties validation
    if (
      !isDraft &&
      !is_draft_issue &&
      !handlePropertyValuesValidation({
        projectId: projectId,
        workspaceSlug: workspaceSlug?.toString(),
        watch: watch,
      })
    )
      return;

    const submitData = !data?.id
      ? formData
      : {
          ...getChangedIssuefields(formData, dirtyFields as { [key: string]: boolean | undefined }),
          project_id: getValues<"project_id">("project_id"),
          id: data.id,
          description_html: formData.description_html ?? "<p></p>",
          type_id: getValues<"type_id">("type_id"),
        };

    // this condition helps to move the issues from draft to project issues
    if (formData.hasOwnProperty("is_draft")) submitData.is_draft = formData.is_draft;

    const propertyPayload =
      isDraft || is_draft_issue
        ? customPropertyPayload(customProperties, customPropertyValues)
        : prepareCustomProperties(projectId!, slug, typeId);
    if (propertyPayload === null) return;
    await onSubmit({ ...submitData, custom_properties: propertyPayload } as Partial<TIssue>, is_draft_issue)
      .then(() => {
        setGptAssistantModal(false);
        setCustomPropertyValues(customPropertyDefaults(customProperties));
        if (isCreateMoreToggleEnabled && workItemTemplateId) {
          handleTemplateChange({
            workspaceSlug: workspaceSlug?.toString(),
            reset,
            editorRef,
          });
        } else {
          reset({
            ...DEFAULT_WORK_ITEM_FORM_VALUES,
            ...(isCreateMoreToggleEnabled ? { ...data } : {}),
            project_id: getValues<"project_id">("project_id"),
            type_id: getValues<"type_id">("type_id"),
            description_html: data?.description_html ?? "<p></p>",
          });
          editorRef?.current?.clearEditor();
        }
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const handleMoveToProjects = async () => {
    if (!data?.id || !data?.project_id || !data) return;
    setIsMoving(true);
    try {
      const custom_properties = prepareCustomProperties(projectId!, slug, typeId);
      if (custom_properties === null) return;
      await moveIssue(workspaceSlug.toString(), data.id, {
        ...data,
        ...getValues(),
        custom_properties,
      } as TWorkspaceDraftIssue);
    } catch {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.failed_to_move_work_item_to_project_please_try_again"),
      });
    } finally {
      setIsMoving(false);
    }
  };

  const condition =
    (watch("name") && watch("name") !== "") || (watch("description_html") && watch("description_html") !== "<p></p>");

  const handleFormChange = () => {
    if (!onChange) return;

    if (isDirty && condition) onChange(watch());
    else onChange(null);
  };

  // executing this useEffect when the parent_id coming from the component prop
  useEffect(() => {
    const parentId = watch("parent_id") || undefined;
    if (!parentId) return;
    if (parentId === selectedParentIssue?.id || selectedParentIssue) return;

    const issue = getIssueById(parentId);
    if (!issue) return;

    const projectDetails = getProjectById(issue.project_id);
    if (!projectDetails) return;

    const stateDetails = getStateById(issue.state_id);

    setSelectedParentIssue(
      convertWorkItemDataToSearchResponse(workspaceSlug?.toString(), issue, projectDetails, stateDetails)
    );
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [watch, getIssueById, getProjectById, selectedParentIssue, getStateById]);

  // executing this useEffect when isDirty changes
  useEffect(() => {
    if (!onChange) return;

    if (isDirty && condition) onChange(watch());
    else onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  useEffect(() => {
    const formElement = formRef?.current;
    const modalElement = modalContainerRef?.current;

    if (!formElement || !modalElement) return;

    const resizeObserver = new ResizeObserver(() => {
      modalElement.style.maxHeight = `${formElement?.offsetHeight}px`;
    });

    resizeObserver.observe(formElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [formRef, modalContainerRef]);

  return (
    <FormProvider {...methods}>
      {/* The form relays DialogContent's max-height into Main/Body: the description scrolls in
          DialogBody, default properties stay pinned in Main and buttons live in DialogActions. */}
      <div className="flex min-h-0 flex-1 gap-2 bg-transparent">
        <form
          ref={formRef}
          onSubmit={handleSubmit((data) => handleFormSubmit(data))}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <DialogMain render={<div className="issue-composer-main" />}>
            <div className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div data-composer-pill-group="">
                  <IssueProjectSelect
                    control={control}
                    disabled={!!data?.id || !!data?.sourceIssueId || isProjectSelectionDisabled}
                    handleFormChange={handleFormChange}
                  />
                </div>
                <ChevronRight className="size-3.5 shrink-0 text-placeholder" aria-hidden="true" />
                <DialogTitle data-composer-heading="">{modalTitle}</DialogTitle>
              </div>
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon icon={X} />}
                aria-label={t("close")}
                onClick={() => {
                  if (editorRef.current?.isEditorReadyToDiscard()) {
                    onClose();
                  } else {
                    setToast({
                      type: "error",
                      title: t("toast.error"),
                      message: t("web.editor_is_still_processing_changes_please_wait_before_procee"),
                    });
                  }
                }}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-3 pt-2">
              {!data?.id && (
                <TemplatePicker
                  workspaceSlug={workspaceSlug?.toString() ?? ""}
                  kind="work_item"
                  projectId={projectId ?? undefined}
                  disabled={isDisabled}
                  onApply={(template) => {
                    const current = getValues();
                    const typeId =
                      template.configuration?.type_id !== undefined ? template.configuration.type_id : current.type_id;
                    const patch = getWorkItemTemplatePatch(
                      template,
                      current,
                      workflowStore.resolve(projectId ?? "", typeId)
                    );
                    setValue("name", patch.name, { shouldDirty: true });
                    setValue("description_html", patch.description_html, { shouldDirty: true });
                    setValue("priority", patch.priority, { shouldDirty: true });
                    if (patch.type_id !== undefined) setValue("type_id", patch.type_id, { shouldDirty: true });
                    setValue("state_id", patch.state_id, { shouldDirty: true });
                    setValue("assignee_ids", patch.assignee_ids, { shouldDirty: true });
                    setValue("label_ids", patch.label_ids, { shouldDirty: true });
                    setValue("module_ids", patch.module_ids, { shouldDirty: true });
                    setValue("template_children", patch.template_children, { shouldDirty: true });
                    editorRef.current?.setEditorValue(template.description_html, true);
                    handleFormChange();
                  }}
                />
              )}
              {watch("parent_id") && selectedParentIssue && (
                <IssueParentTag
                  control={control}
                  selectedParentIssue={selectedParentIssue}
                  handleFormChange={handleFormChange}
                  setSelectedParentIssue={setSelectedParentIssue}
                />
              )}
              <IssueTitleInput
                control={control}
                issueTitleRef={issueTitleRef}
                formState={formState}
                handleFormChange={handleFormChange}
              />
            </div>
            <DialogBody tabIndex={0} render={<div className="vertical-scrollbar scrollbar-sm [&>div]:w-auto" />}>
              <IssueDescriptionEditor
                control={control}
                isDraft={isDraft}
                issueName={watch("name")}
                issueId={data?.id}
                descriptionHtmlData={data?.description_html}
                editorRef={editorRef}
                submitBtnRef={submitBtnRef}
                gptAssistantModal={gptAssistantModal}
                workspaceSlug={workspaceSlug?.toString()}
                projectId={projectId}
                handleFormChange={handleFormChange}
                handleDescriptionHTMLDataChange={(description_html) =>
                  setValue<"description_html">("description_html", description_html)
                }
                setGptAssistantModal={setGptAssistantModal}
                handleGptAssistantClose={() => reset(getValues())}
                onAssetUpload={onAssetUpload}
                onClose={onClose}
              />
            </DialogBody>
            <div className="shrink-0" data-composer-pill-group="">
              <IssueDefaultProperties
                control={control}
                id={data?.id}
                projectId={projectId}
                workspaceSlug={workspaceSlug?.toString()}
                selectedParentIssue={selectedParentIssue}
                startDate={watch("start_date")}
                targetDate={watch("target_date")}
                parentId={watch("parent_id")}
                isDraft={isDraft}
                handleFormChange={handleFormChange}
                setSelectedParentIssue={setSelectedParentIssue}
              />
            </div>
            <div className="max-h-64 shrink-0 overflow-y-auto py-2">
              {customPropertiesError ? (
                <div role="alert">
                  <p className="text-caption-sm-regular text-danger-primary">
                    {t("web.work_item_properties.load_failed")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    stretch="auto"
                    label={t("web.work_item_properties.retry")}
                    onClick={retryCustomProperties}
                  />
                </div>
              ) : customPropertiesLoading || customPropertyContext !== `${slug}:${projectId}:${typeId ?? ""}` ? (
                <p role="status">{t("web.work_item_properties.loading")}</p>
              ) : (
                <CustomPropertyFields
                  properties={customProperties}
                  values={customPropertyValues}
                  projectId={projectId!}
                  disabled={isDisabled}
                  errors={customPropertyErrors}
                  onChange={(id, value) => setCustomPropertyValues((current) => ({ ...current, [id]: value }))}
                />
              )}
            </div>
          </DialogMain>
          {showActionButtons && (
            <DialogActions render={<div className="issue-composer-actions" />}>
              {!data?.id && onDiscard && (
                <DialogInfo>
                  <Button
                    variant="secondary"
                    size="md"
                    stretch="auto"
                    type="button"
                    label={t("web.discard")}
                    disabled={isDisabled || isMoving}
                    onClick={() => {
                      if (!editorRef.current?.isEditorReadyToDiscard()) {
                        setToast({
                          type: "error",
                          title: t("error"),
                          message: t("editor_is_not_ready_to_discard_changes"),
                        });
                        return;
                      }
                      onDiscard();
                    }}
                  />
                </DialogInfo>
              )}
              {!data?.id && (
                <label className="inline-flex cursor-pointer items-center gap-1.5" tabIndex={getIndex("create_more")}>
                  <Switch
                    size="md"
                    checked={isCreateMoreToggleEnabled}
                    onCheckedChange={(checked) => onCreateMoreToggleChange(checked)}
                    aria-label={t("create_more")}
                  />
                  <span className="text-caption-sm-regular">{t("create_more")}</span>
                </label>
              )}
              <div tabIndex={isDraft ? getIndex("submit_button") : getIndex("draft_button")}>
                <Button
                  variant={moveToIssue ? "secondary" : "primary"}
                  size="md"
                  stretch="auto"
                  type="submit"
                  ref={submitBtnRef}
                  loading={isSubmitting}
                  disabled={isDisabled}
                  label={isSubmitting ? primaryButtonText.loading : primaryButtonText.default}
                />
              </div>
              {moveToIssue && (
                <Button
                  variant="primary"
                  type="button"
                  loading={isMoving}
                  onClick={handleMoveToProjects}
                  disabled={isMoving}
                  size="md"
                  stretch="auto"
                  label={t("add_to_project")}
                />
              )}
            </DialogActions>
          )}
        </form>
      </div>
    </FormProvider>
  );
});
