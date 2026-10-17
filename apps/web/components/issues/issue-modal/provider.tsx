/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import {
  customPropertyDefaults,
  customPropertyErrors as validateProperties,
  customPropertyPayload,
} from "@/helpers/custom-properties";
import { useCustomPropertyDefinitions } from "@/hooks/use-issue-properties";
import { CustomPropertiesService } from "@/services/project/custom-properties.service";
import type { TCustomPropertyValues } from "@/services/project/custom-properties.types";
import { observer } from "mobx-react";
// plane imports
import type { ISearchIssueResponse, TIssue } from "@plane/types";
// components
import { IssueModalContext } from "@/components/issues/issue-modal/context";
// hooks
import { useUser } from "@/hooks/store/user/user-user";

export type TIssueModalProviderProps = {
  templateId?: string;
  dataForPreload?: Partial<TIssue>;
  allowedProjectIds?: string[];
  children: React.ReactNode;
};

export const IssueModalProvider = observer(function IssueModalProvider(props: TIssueModalProviderProps) {
  const { children, allowedProjectIds, dataForPreload } = props;
  const { t } = useTranslation();
  const [context, setContext] = useState<{
    projectId: string;
    workspaceSlug: string;
    typeId?: string | null;
    isDraft?: boolean;
  }>();
  const [customPropertyValues, setValues] = useState<TCustomPropertyValues>(
    (dataForPreload as (Partial<TIssue> & { custom_properties?: TCustomPropertyValues }) | undefined)
      ?.custom_properties ?? {}
  );
  const editedKeys = useRef(new Set<string>());
  const latestValues = useRef(customPropertyValues);
  useEffect(() => {
    latestValues.current = customPropertyValues;
  }, [customPropertyValues]);
  const setCustomPropertyValues = useCallback<React.Dispatch<React.SetStateAction<TCustomPropertyValues>>>((next) => {
    const current = latestValues.current;
    const values = typeof next === "function" ? next(current) : next;
    for (const key of Object.keys(values))
      if (JSON.stringify(values[key]) !== JSON.stringify(current[key])) editedKeys.current.add(key);
    latestValues.current = values;
    setValues(values);
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preload, setPreload] = useState<{ key: string; error?: unknown }>();
  const [retryCount, setRetryCount] = useState(0);
  const definitions = useCustomPropertyDefinitions(context?.workspaceSlug, context?.projectId, context?.typeId);
  const contextKey = context ? `${context.workspaceSlug}:${context.projectId}:${context.typeId ?? ""}` : "";
  const previousProject = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!context) return;
    const projectKey = `${context.workspaceSlug}:${context.projectId}`;
    if (previousProject.current !== projectKey) {
      if (previousProject.current) {
        setValues({});
        editedKeys.current.clear();
      }
      previousProject.current = projectKey;
      setErrors({});
    }
  }, [context]);
  useEffect(() => {
    if (definitions.data) setValues((current) => ({ ...customPropertyDefaults(definitions.properties), ...current }));
  }, [definitions.data, definitions.properties]);
  const preloadSlug = context?.workspaceSlug;
  const preloadProjectId = context?.projectId;
  const preloadDraft = context?.isDraft;
  const preloadIssueId = dataForPreload?.id;
  const preloadIssueProject = dataForPreload?.project_id;
  useEffect(() => {
    if (
      !preloadSlug ||
      !preloadProjectId ||
      preloadDraft ||
      !preloadIssueId ||
      preloadIssueProject !== preloadProjectId
    )
      return;
    let cancelled = false;
    const key = `${preloadProjectId}:${preloadIssueId}`;
    new CustomPropertiesService()
      .values(preloadSlug, preloadProjectId, preloadIssueId)
      .then(({ values }) => {
        if (!cancelled) {
          setValues((current) => ({
            ...current,
            ...Object.fromEntries(Object.entries(values).filter(([id]) => !editedKeys.current.has(id))),
          }));
          setPreload({ key });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreload({ key, error });
          setToast({ type: "error", title: t("web.work_item_properties.load_failed") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preloadSlug, preloadProjectId, preloadDraft, preloadIssueId, preloadIssueProject, retryCount, t]);
  const prepareCustomProperties = (projectId: string, workspaceSlug: string, typeId?: string | null) => {
    if (
      contextKey !== `${workspaceSlug}:${projectId}:${typeId ?? ""}` ||
      !definitions.data ||
      definitions.error ||
      (!!dataForPreload?.id &&
        !context?.isDraft &&
        (preload?.key !== `${projectId}:${dataForPreload.id}` || preload.error))
    ) {
      setToast({
        type: "error",
        title: t("web.work_item_properties.load_failed"),
        message: t("web.work_item_properties.retry_hint"),
      });
      return null;
    }
    const nextErrors = validateProperties(definitions.properties, customPropertyValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;
    return customPropertyPayload(definitions.properties, customPropertyValues);
  };
  const handleProjectEntitiesFetch = useCallback(
    async ({
      workItemProjectId,
      workItemTypeId,
      workspaceSlug,
      isDraft,
    }: import("./context/issue-modal-context").THandleProjectEntitiesFetchProps) => {
      if (!workItemProjectId) return;
      setContext((current) =>
        current?.projectId === workItemProjectId &&
        current.workspaceSlug === workspaceSlug &&
        current.typeId === workItemTypeId &&
        current.isDraft === isDraft
          ? current
          : { projectId: workItemProjectId, workspaceSlug, typeId: workItemTypeId, isDraft }
      );
    },
    []
  );
  // states
  const [selectedParentIssue, setSelectedParentIssue] = useState<ISearchIssueResponse | null>(null);
  // store hooks
  const { projectsWithCreatePermissions } = useUser();
  // derived values
  const projectIdsWithCreatePermissions = Object.keys(projectsWithCreatePermissions ?? {});

  return (
    <IssueModalContext.Provider
      // oxlint-disable-next-line react/jsx-no-constructed-context-values
      value={{
        allowedProjectIds: allowedProjectIds ?? projectIdsWithCreatePermissions,
        workItemTemplateId: null,
        setWorkItemTemplateId: () => {},
        isApplyingTemplate: false,
        setIsApplyingTemplate: () => {},
        selectedParentIssue,
        setSelectedParentIssue,
        customProperties: definitions.properties,
        customPropertyValues,
        setCustomPropertyValues,
        customPropertyErrors: errors,
        customPropertiesLoading:
          definitions.isLoading ||
          (!!dataForPreload?.id && !context?.isDraft && preload?.key !== `${context?.projectId}:${dataForPreload.id}`),
        customPropertiesError: definitions.error || preload?.error,
        customPropertyContext: contextKey,
        retryCustomProperties: () => {
          void definitions.mutate();
          setPreload(undefined);
          setRetryCount((count) => count + 1);
        },
        prepareCustomProperties,
        issuePropertyValues: customPropertyValues,
        setIssuePropertyValues: (next) =>
          setCustomPropertyValues(
            (current) => (typeof next === "function" ? next(current) : next) as TCustomPropertyValues
          ),
        issuePropertyValueErrors: errors,
        setIssuePropertyValueErrors: (next) =>
          setErrors((current) => (typeof next === "function" ? next(current) : next) as Record<string, string>),
        getIssueTypeIdOnProjectChange: () => null,
        getActiveAdditionalPropertiesLength: () => definitions.properties.length,
        handlePropertyValuesValidation: ({ projectId, workspaceSlug, watch }) =>
          !!projectId && prepareCustomProperties(projectId, workspaceSlug, watch("type_id")) !== null,
        // The modal sends these values atomically in the work item's POST/PATCH payload.
        handleCreateUpdatePropertyValues: async () => {},
        handleProjectEntitiesFetch,
        handleTemplateChange: () => Promise.resolve(),
        handleConvert: () => Promise.resolve(),
        handleCreateSubWorkItem: () => Promise.resolve(),
      }}
    >
      {children}
    </IssueModalContext.Provider>
  );
});
