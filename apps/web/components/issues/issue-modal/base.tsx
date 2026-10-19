/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Scoped composer styles are intentionally loaded for their side effect.
// oxlint-disable-next-line import/no-unassigned-import
import "./composer.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { isEqual } from "lodash-es";
import { getIssueModuleChanges } from "@/helpers/issue-modules";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// Plane imports
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TBaseIssue, TIssue } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { hierarchyErrorKey } from "@/helpers/issue-hierarchy";
import { getDialogInitialFocusProps } from "@/helpers/dialog";
// hooks
import { useIssueModal } from "@/hooks/context/use-issue-modal";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useModule } from "@/hooks/store/use-module";
import { useUser } from "@/hooks/store/user";
import { prepareComposerMotion, COMPOSER_RESTORE_DURATION, COMPOSER_MOTION_EASING } from "./composer-motion";
import {
  saveComposerDraft,
  readComposerDraft,
  composerCacheKey,
  composerDraftContext,
  hasComposerContent,
} from "./composer-cache";
import { useProject } from "@/hooks/store/use-project";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// services
import { FileService } from "@/services/file.service";
const fileService = new FileService();
// local imports
import { useCreateIssueToastActions } from "../create-issue-toast-action-items";
import { DraftIssueLayout } from "./draft-issue-layout";
import { IssueFormRoot } from "./form";
import type { IssueFormProps } from "./form";
import type { IssuesModalProps } from "./modal";

type TTranslationFn = ReturnType<typeof useTranslation>["t"];

type TIssueOrganizerStore = {
  addIssueToCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => Promise<void>;
  removeIssueFromCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<void>;
  changeModulesInIssue: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    addModuleIds: string[],
    removeModuleIds: string[]
  ) => Promise<void>;
};

type TFetchCycleDetails = (workspaceSlug: string, projectId: string, cycleId: string) => Promise<unknown>;
type TFetchModuleDetails = (workspaceSlug: string, projectId: string, moduleId: string) => Promise<unknown>;

const resolveIssueStoreType = (
  issueStoreFromProps: EIssuesStoreType | undefined,
  issueStoreType: EIssuesStoreType
): EIssuesStoreType => issueStoreFromProps ?? issueStoreType;

const buildComposerDraftState = (args: {
  currentUserId: string | undefined;
  workspaceSlug: string | undefined;
  data: Partial<TIssue> | undefined;
  templateId: string | undefined;
  projectId: string | undefined;
  isDraft: boolean;
}) => {
  const canCacheDraft = !args.data?.id && !args.data?.sourceIssueId && !args.templateId;
  const cacheKey =
    args.currentUserId && args.workspaceSlug && canCacheDraft
      ? composerCacheKey(
          args.currentUserId,
          args.workspaceSlug,
          composerDraftContext(args.projectId, args.data?.parent_id, args.isDraft)
        )
      : undefined;
  const cachedDraft = cacheKey ? readComposerDraft(cacheKey) : undefined;
  const clearCachedDraft = () => {
    if (cacheKey) saveComposerDraft(cacheKey);
  };
  return { cacheKey, cachedDraft, clearCachedDraft };
};

const payloadIncludesModule = (payload: Partial<TIssue>, moduleId: string | string[] | undefined) =>
  moduleId !== undefined && (payload.module_ids?.includes(moduleId.toString()) ?? false);

const shouldCreateInProjectStore = (args: {
  payload: Partial<TIssue>;
  storeType: EIssuesStoreType;
  cycleId: string | string[] | undefined;
  moduleId: string | string[] | undefined;
}) =>
  (args.payload.cycle_id !== args.cycleId && args.storeType === EIssuesStoreType.CYCLE) ||
  (!payloadIncludesModule(args.payload, args.moduleId) && args.storeType === EIssuesStoreType.MODULE);

const createIssueRecord = async (args: {
  isDraftIssue: boolean;
  payload: Partial<TIssue>;
  storeType: EIssuesStoreType;
  cycleId: string | string[] | undefined;
  moduleId: string | string[] | undefined;
  createDraftIssue: () => Promise<TIssue>;
  createProjectIssue: () => Promise<TIssue>;
  createStoreIssue: (() => Promise<TIssue | undefined>) | undefined;
}): Promise<TIssue | undefined> => {
  if (args.isDraftIssue) return args.createDraftIssue();
  if (shouldCreateInProjectStore(args)) return args.createProjectIssue();
  return args.createStoreIssue ? args.createStoreIssue() : undefined;
};

const hasAssetsToSync = (uploadedAssetIds: string[], cachedAssetIds: string[] | undefined) =>
  uploadedAssetIds.length > 0 || Boolean(cachedAssetIds?.length);

const syncUploadedAssets = async (args: {
  workspaceSlug: string;
  response: TIssue | undefined;
  assetIds: string[];
}) => {
  await fileService.updateBulkProjectAssetsUploadStatus(
    args.workspaceSlug,
    args.response?.project_id ?? "",
    args.response?.id ?? "",
    { asset_ids: args.assetIds }
  );
};

const shouldAddCreatedIssueToCycle = (args: {
  payload: Partial<TIssue>;
  storeType: EIssuesStoreType;
  cycleId: string | string[] | undefined;
  isDraftIssue: boolean;
}) =>
  !args.isDraftIssue &&
  Boolean(args.payload.cycle_id) &&
  args.payload.cycle_id !== "" &&
  (args.payload.cycle_id !== args.cycleId || args.storeType !== EIssuesStoreType.CYCLE);

const shouldAddCreatedIssueToModule = (args: {
  payload: Partial<TIssue>;
  storeType: EIssuesStoreType;
  moduleId: string | string[] | undefined;
  isDraftIssue: boolean;
}) =>
  !args.isDraftIssue &&
  Boolean(args.payload.module_ids) &&
  (args.payload.module_ids?.length ?? 0) > 0 &&
  (!payloadIncludesModule(args.payload, args.moduleId) || args.storeType !== EIssuesStoreType.MODULE);

const getIssueMutationErrorMessage = (error: unknown, t: TTranslationFn, fallbackKey: string): string => {
  const hierarchyKey = hierarchyErrorKey(error, "");
  if (hierarchyKey) return t(hierarchyKey);
  const apiError = (error as { error?: string } | null | undefined)?.error;
  return apiError ?? t(fallbackKey);
};

const addIssueToCycleInStore = async (args: {
  workspaceSlug: string | undefined;
  issue: TIssue;
  targetCycleId: string;
  issues: TIssueOrganizerStore;
  fetchCycleDetails: TFetchCycleDetails;
}) => {
  if (!args.workspaceSlug || !args.issue.project_id) return;
  const workspaceSlug = args.workspaceSlug.toString();
  const projectId = args.issue.project_id;
  await args.issues.addIssueToCycle(workspaceSlug, projectId, args.targetCycleId, [args.issue.id]);
  args.fetchCycleDetails(workspaceSlug, projectId, args.targetCycleId);
};

const addIssueToModuleInStore = async (args: {
  workspaceSlug: string | undefined;
  issue: TIssue;
  moduleIds: string[];
  issues: TIssueOrganizerStore;
  fetchModuleDetails: TFetchModuleDetails;
}) => {
  if (!args.workspaceSlug || !args.issue.project_id) return;
  const workspaceSlug = args.workspaceSlug.toString();
  const projectId = args.issue.project_id;
  await Promise.all([
    args.issues.changeModulesInIssue(workspaceSlug, projectId, args.issue.id, args.moduleIds, []),
    ...args.moduleIds.map(
      (targetModuleId) =>
        args.issue.project_id && args.fetchModuleDetails(workspaceSlug, args.issue.project_id, targetModuleId)
    ),
  ]);
};

const changeIssueCycle = async (args: {
  workspaceSlug: string | undefined;
  currentIssue: Partial<TIssue> | undefined;
  payload: Partial<TIssue>;
  storeType: EIssuesStoreType;
  cycleId: string | string[] | undefined;
  issues: TIssueOrganizerStore;
  fetchCycleDetails: TFetchCycleDetails;
  addIssueToCycle: (issue: TIssue, targetCycleId: string) => Promise<void>;
}) => {
  if (!args.workspaceSlug || !args.currentIssue?.project_id || !args.currentIssue?.id) return;
  // return if user is not trying to change the cycle, i.e
  // - cycle_id is not present in payload
  // - cycle_id is the same as the current cycle id
  if (!("cycle_id" in args.payload) || isEqual(args.currentIssue.cycle_id, args.payload.cycle_id)) return;

  const workspaceSlug = args.workspaceSlug.toString();
  const projectId = args.currentIssue.project_id;

  // Removing the cycle
  const currentCycleId = args.currentIssue.cycle_id;
  if (currentCycleId && args.payload.cycle_id === null) {
    await args.issues.removeIssueFromCycle(workspaceSlug, projectId, currentCycleId, args.currentIssue.id);
    args.fetchCycleDetails(workspaceSlug, projectId, currentCycleId).catch((error: unknown) => {
      console.error(error);
    });
  }

  // Adding the cycle
  const newCycleId = args.payload.cycle_id;
  if (
    newCycleId &&
    newCycleId !== "" &&
    (args.payload.cycle_id !== args.cycleId || args.storeType !== EIssuesStoreType.CYCLE)
  ) {
    await args.addIssueToCycle(args.currentIssue as TBaseIssue, newCycleId);
  }
};

const changeIssueModules = async (args: {
  workspaceSlug: string | undefined;
  currentIssue: Partial<TIssue> | undefined;
  payload: Partial<TIssue>;
  issues: TIssueOrganizerStore;
}) => {
  if (!args.workspaceSlug || !args.currentIssue?.project_id || !args.currentIssue?.id) return;
  // return if user is not trying to change the module, i.e
  // - module_ids is not present in payload
  // - module_ids is not an array
  // - module_ids is the same as the current module ids
  if (
    !("module_ids" in args.payload) ||
    !Array.isArray(args.payload.module_ids) ||
    isEqual(args.currentIssue?.module_ids, args.payload.module_ids)
  )
    return;

  const { modulesToAdd, modulesToRemove } = getIssueModuleChanges(
    args.currentIssue.module_ids,
    args.payload.module_ids
  );
  // update modules if there are modules to add or remove
  if (modulesToAdd.length > 0 || modulesToRemove.length > 0) {
    await args.issues.changeModulesInIssue(
      args.workspaceSlug.toString(),
      args.currentIssue.project_id,
      args.currentIssue.id,
      modulesToAdd,
      modulesToRemove
    );
  }
};

const buildKeepDraftHandler = (args: {
  cacheKey: string;
  cachedDraft: ReturnType<typeof readComposerDraft>;
  uploadedAssetIds: string[];
  isDraft: boolean;
  onClose: () => void;
}) => {
  return (values: Partial<TIssue>, hasChanges: boolean) => {
    const draft = {
      values,
      hasChanges: hasChanges || args.cachedDraft?.hasChanges,
      assetIds: [...new Set([...(args.cachedDraft?.assetIds ?? []), ...args.uploadedAssetIds])],
    };
    saveComposerDraft(args.cacheKey, hasComposerContent(draft) ? draft : undefined);
    const popup = document.querySelector<HTMLElement>("[data-issue-composer]");
    if (popup && hasComposerContent(draft) && prepareComposerMotion(popup, args.isDraft ? "draft" : "new")) {
      popup.dataset.minimizing = "true";
    }
    args.onClose();
  };
};

const buildIssueModalData = (args: {
  data: Partial<TIssue> | undefined;
  description: string | undefined;
  cycleId: string | string[] | undefined;
  moduleId: string | string[] | undefined;
  cachedDraftValues: Partial<TIssue> | undefined;
}): Partial<TIssue> => ({
  ...args.data,
  description_html: args.description,
  cycle_id: args.data?.cycle_id ? args.data.cycle_id : args.cycleId ? args.cycleId.toString() : null,
  module_ids: args.data?.module_ids ? args.data.module_ids : args.moduleId ? [args.moduleId.toString()] : null,
  ...args.cachedDraftValues,
});

function useComposerRestoreAnimation(cacheKey: string | undefined, isDraft: boolean) {
  const motionInitialized = useRef(false);
  return useCallback(
    (popup: HTMLDivElement | null) => {
      if (!popup || motionInitialized.current) return;
      motionInitialized.current = true;
      if (!cacheKey || !readComposerDraft(cacheKey)) return;
      const travel = prepareComposerMotion(popup, isDraft ? "draft" : "new");
      if (!travel) return;
      popup.animate(
        [
          { translate: travel, scale: "0.2", opacity: 0 },
          { translate: "0px 0px", scale: "1", opacity: 1 },
        ],
        { duration: COMPOSER_RESTORE_DURATION, easing: COMPOSER_MOTION_EASING }
      );
    },
    [cacheKey, isDraft]
  );
}

export const CreateUpdateIssueModalBase = observer(function CreateUpdateIssueModalBase(props: IssuesModalProps) {
  const {
    data,
    isOpen,
    onClose,
    beforeFormSubmit,
    onSubmit,
    withDraftIssueWrapper = true,
    storeType: issueStoreFromProps,
    isDraft = false,
    fetchIssueDetails = true,
    moveToIssue = false,
    modalTitle,
    primaryButtonText,
    isProjectSelectionDisabled = false,
    showActionItemsOnUpdate = false,
  } = props;
  const issueStoreType = useIssueStoreType();
  const storeType = resolveIssueStoreType(issueStoreFromProps, issueStoreType);
  // ref
  const closeRequestRef = useRef<(() => void) | null>(null);
  const issueTitleRef = useRef<HTMLInputElement>(null);
  // states
  const [changesMade, setChangesMade] = useState<Partial<TIssue> | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  // store hooks
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { workspaceSlug, projectId: routerProjectId, cycleId, moduleId, workItem } = useParams();
  const { fetchCycleDetails } = useCycle();
  const { fetchModuleDetails } = useModule();
  const { issues } = useIssues(storeType);
  const { issues: projectIssues } = useIssues(EIssuesStoreType.PROJECT);
  const { issues: draftIssues } = useIssues(EIssuesStoreType.WORKSPACE_DRAFT);
  const { fetchIssue } = useIssueDetail();
  const { allowedProjectIds, handleCreateSubWorkItem } = useIssueModal();
  const { getProjectByIdentifier } = useProject();
  // current store details
  const { createIssue, updateIssue } = useIssuesActions(storeType);
  // propel: toast actions cross the boundary as data, never as JSX
  const buildCreateIssueToastActions = useCreateIssueToastActions();
  // derived values
  const routerProjectIdentifier = workItem?.toString().split("-")[0];
  const projectIdFromRouter = getProjectByIdentifier(routerProjectIdentifier)?.id;
  const projectId = data?.project_id ?? routerProjectId?.toString() ?? projectIdFromRouter;
  const workspaceSlugValue = workspaceSlug?.toString();

  const { cacheKey, cachedDraft, clearCachedDraft } = buildComposerDraftState({
    currentUserId: currentUser?.id,
    workspaceSlug: workspaceSlugValue,
    data,
    templateId: props.templateId,
    projectId,
    isDraft,
  });
  const composerRef = useComposerRestoreAnimation(cacheKey, isDraft);

  const issueIdToFetch = data?.id ?? data?.sourceIssueId;
  const descriptionFallback = cachedDraft?.values.description_html ?? data?.description_html ?? "<p></p>";

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setDescription(undefined);
    if (!workspaceSlugValue || !projectId || issueIdToFetch === undefined || !fetchIssueDetails) {
      setDescription(descriptionFallback);
      return;
    }
    void fetchIssue(workspaceSlugValue, projectId, issueIdToFetch)
      .then((response) => {
        if (!cancelled && response) setDescription(response.description_html || "<p></p>");
        return response;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error(error);
          setDescription(descriptionFallback);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceSlugValue, projectId, issueIdToFetch, fetchIssueDetails, fetchIssue, descriptionFallback]);

  const dataProjectId = data?.project_id;
  const cachedProjectId = cachedDraft?.values.project_id;
  const fallbackProjectId =
    cachedProjectId && allowedProjectIds?.includes(cachedProjectId)
      ? cachedProjectId
      : (projectId?.toString() ?? allowedProjectIds?.[0]);
  useEffect(() => {
    // Preserve the current project and description while the dialog exits.
    if (!isOpen) return;
    setActiveProjectId((current) => {
      // If data is present, the issue's project wins over the project in the url.
      if (dataProjectId) return dataProjectId;
      // Otherwise keep the current project, or fall back to the first allowed project.
      if (allowedProjectIds && allowedProjectIds.length > 0 && !current) return fallbackProjectId ?? null;
      return current;
    });
  }, [dataProjectId, fallbackProjectId, isOpen, allowedProjectIds]);

  const addIssueToCycle = (issue: TIssue, targetCycleId: string) =>
    addIssueToCycleInStore({
      workspaceSlug: workspaceSlugValue,
      issue,
      targetCycleId,
      issues,
      fetchCycleDetails,
    });

  const addIssueToModule = (issue: TIssue, moduleIds: string[]) =>
    addIssueToModuleInStore({
      workspaceSlug: workspaceSlugValue,
      issue,
      moduleIds,
      issues,
      fetchModuleDetails,
    });

  const handleCreateMoreToggleChange = (value: boolean) => {
    setCreateMore(value);
  };

  const handleClose = (saveAsDraft?: boolean) => {
    if (changesMade && saveAsDraft && !data) {
      handleCreateIssue(changesMade, true);
    }

    // Keep the rendered form intact until the closing transition has finished.
    onClose();
  };

  const handleCreateIssue = async (
    payload: Partial<TIssue>,
    is_draft_issue: boolean = false
  ): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id) return;

    const workspaceSlugString = workspaceSlug.toString();
    try {
      const response = await createIssueRecord({
        isDraftIssue: is_draft_issue,
        payload,
        storeType,
        cycleId,
        moduleId,
        createDraftIssue: async () => (await draftIssues.createIssue(workspaceSlugString, payload)) as TIssue,
        createProjectIssue: () => projectIssues.createIssue(workspaceSlugString, payload.project_id as string, payload),
        createStoreIssue: createIssue ? () => createIssue(payload.project_id, payload) : undefined,
      });

      // update uploaded assets' status
      if (hasAssetsToSync(uploadedAssetIds, cachedDraft?.assetIds)) {
        await syncUploadedAssets({
          workspaceSlug: workspaceSlugString,
          response,
          assetIds: [...new Set([...(cachedDraft?.assetIds ?? []), ...uploadedAssetIds])],
        });
        setUploadedAssetIds([]);
      }

      if (!response) throw new Error();

      // check if we should add issue to cycle/module
      if (shouldAddCreatedIssueToCycle({ payload, storeType, cycleId, isDraftIssue: is_draft_issue })) {
        if (payload.cycle_id) await addIssueToCycle(response, payload.cycle_id);
      }
      if (shouldAddCreatedIssueToModule({ payload, storeType, moduleId, isDraftIssue: is_draft_issue })) {
        if (payload.module_ids) await addIssueToModule(response, payload.module_ids);
      }

      // add other property values
      if (response.id && response.project_id) {
        // create sub work item
        await handleCreateSubWorkItem({
          workspaceSlug: workspaceSlugValue,
          projectId: response.project_id,
          parentId: response.id,
        });
      }

      setToast({
        type: "success",
        title: t("success"),
        message: `${is_draft_issue ? t("draft_created") : t("issue_created_successfully")} `,
        actionItems:
          !is_draft_issue && response?.project_id
            ? buildCreateIssueToastActions({ workspaceSlug: workspaceSlugString, issueId: response.id })
            : undefined,
      });
      clearCachedDraft();
      if (!createMore) handleClose();
      if (createMore && issueTitleRef) issueTitleRef?.current?.focus();
      setDescription("<p></p>");
      setChangesMade(null);
      return response;
    } catch (error: unknown) {
      setToast({
        type: "error",
        title: t("error"),
        message: getIssueMutationErrorMessage(
          error,
          t,
          is_draft_issue ? "draft_creation_failed" : "issue_creation_failed"
        ),
      });
      throw error;
    }
  };

  const handleCycleChange = (currentIssue: Partial<TIssue> | undefined, payload: Partial<TIssue>) =>
    changeIssueCycle({
      workspaceSlug: workspaceSlugValue,
      currentIssue,
      payload,
      storeType,
      cycleId,
      issues,
      fetchCycleDetails,
      addIssueToCycle,
    });

  const handleModuleChange = (currentIssue: Partial<TIssue> | undefined, payload: Partial<TIssue>) =>
    changeIssueModules({
      workspaceSlug: workspaceSlugValue,
      currentIssue,
      payload,
      issues,
    });

  const handleUpdateIssue = async (payload: Partial<TIssue>): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id || !data?.id) return;

    try {
      if (isDraft) await draftIssues.updateIssue(workspaceSlug.toString(), data.id, payload);
      else if (updateIssue) await updateIssue(payload.project_id, data.id, payload);

      // Run cycle, module, and property changes sequentially to avoid
      // optimistic store writes from racing against each other.
      await handleCycleChange(data, payload);
      await handleModuleChange(data, payload);

      setToast({
        type: "success",
        title: t("success"),
        message: t("issue_updated_successfully"),
        actionItems:
          showActionItemsOnUpdate && payload.project_id
            ? buildCreateIssueToastActions({ workspaceSlug: workspaceSlug.toString(), issueId: data.id })
            : undefined,
      });
      handleClose();
    } catch (error: unknown) {
      console.error(error);
      setToast({
        type: "error",
        title: t("error"),
        message: getIssueMutationErrorMessage(error, t, "issue_could_not_be_updated"),
      });
      throw error;
    }
  };

  const handleFormSubmit = async (payload: Partial<TIssue>, is_draft_issue: boolean = false) => {
    if (!workspaceSlug || !payload.project_id || !storeType) return;
    // remove sourceIssueId from payload since it is not needed
    if (data?.sourceIssueId) delete data.sourceIssueId;

    let response: TIssue | undefined = undefined;

    try {
      if (beforeFormSubmit) await beforeFormSubmit();
      if (!data?.id) response = await handleCreateIssue(payload, is_draft_issue);
      else response = await handleUpdateIssue(payload);
    } finally {
      if (response != undefined && onSubmit) await onSubmit(response);
    }
  };

  const handleFormChange = (formData: Partial<TIssue> | null) => {
    if (formData === null) clearCachedDraft();
    setChangesMade(formData);
  };

  const handleUpdateUploadedAssetIds = (assetId: string) => setUploadedAssetIds((prev) => [...prev, assetId]);

  const handleDuplicateIssueModal = (value: boolean) => setIsDuplicateModalOpen(value);

  // don't open the modal if there are no projects
  if (!allowedProjectIds || allowedProjectIds.length === 0 || !activeProjectId) return null;

  const commonIssueModalProps: IssueFormProps = {
    issueTitleRef: issueTitleRef,
    data: buildIssueModalData({
      data,
      description,
      cycleId,
      moduleId,
      cachedDraftValues: cachedDraft?.values,
    }),
    onAssetUpload: handleUpdateUploadedAssetIds,
    onClose: handleClose,
    closeRequestRef,
    onKeepDraft: cacheKey
      ? buildKeepDraftHandler({
          cacheKey,
          cachedDraft,
          uploadedAssetIds,
          isDraft,
          onClose: handleClose,
        })
      : undefined,
    onSubmit: (payload) => handleFormSubmit(payload, isDraft),
    projectId: activeProjectId,
    isCreateMoreToggleEnabled: createMore,
    onCreateMoreToggleChange: handleCreateMoreToggleChange,
    isDraft: isDraft,
    moveToIssue: moveToIssue,
    modalTitle: modalTitle,
    primaryButtonText: primaryButtonText,
    isDuplicateModalOpen: isDuplicateModalOpen,
    handleDuplicateIssueModal: handleDuplicateIssueModal,
    isProjectSelectionDisabled: isProjectSelectionDisabled,
  };

  return (
    /* The modal it replaces passed no `handleClose`, so only its own form dismisses it. */
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeRequestRef.current?.();
      }}
    >
      <DialogContent
        ref={composerRef}
        size="lg"
        data-issue-composer=""
        {...getDialogInitialFocusProps("[data-composer-title]")}
      >
        {withDraftIssueWrapper ? (
          <DraftIssueLayout {...commonIssueModalProps} changesMade={changesMade} onChange={handleFormChange} />
        ) : (
          <IssueFormRoot {...commonIssueModalProps} />
        )}
      </DialogContent>
    </Dialog>
  );
});
