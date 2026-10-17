import { useMemo, useState } from "react";
import useSWR from "swr";
import type { TIssueServiceType } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { activeCustomProperties } from "@/helpers/custom-properties";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { CustomPropertiesService } from "@/services/project/custom-properties.service";
import type { TCustomPropertyValues } from "@/services/project/custom-properties.types";

const service = new CustomPropertiesService();

export function useCustomPropertyDefinitions(
  workspaceSlug?: string | null,
  projectId?: string | null,
  typeId?: string | null
) {
  const result = useSWR(
    workspaceSlug && projectId ? ["custom-properties", workspaceSlug, projectId, typeId ?? "all"] : null,
    () => service.list(workspaceSlug!, projectId!, typeId ?? undefined),
    { keepPreviousData: false }
  );
  const properties = useMemo(() => activeCustomProperties(result.data?.results ?? []), [result.data]);
  return { ...result, properties };
}

export const useWorkItemProperties = (
  projectId: string | null | undefined,
  workspaceSlug: string | null | undefined,
  workItemId: string | null | undefined,
  issueServiceType: TIssueServiceType = EIssueServiceType.ISSUES
) => {
  const {
    issue: { getIssueById },
    fetchActivities,
  } = useIssueDetail();
  const issue = workItemId ? getIssueById(workItemId) : undefined;
  const enabled = issueServiceType === EIssueServiceType.ISSUES;
  const definitions = useCustomPropertyDefinitions(enabled ? workspaceSlug : null, projectId, issue?.type_id);
  const values = useSWR(
    enabled && workspaceSlug && projectId && workItemId
      ? ["custom-property-values", workspaceSlug, projectId, workItemId]
      : null,
    () => service.values(workspaceSlug!, projectId!, workItemId!)
  );
  const [isSaving, setIsSaving] = useState(false);
  const save = async (patch: TCustomPropertyValues) => {
    if (!enabled || !workspaceSlug || !projectId || !workItemId) throw new Error("Missing work item context");
    setIsSaving(true);
    try {
      const response = await service.updateValues(workspaceSlug, projectId, workItemId, patch);
      // Merge only the submitted keys: concurrent field responses must not replace one another.
      const saved = Object.fromEntries(Object.keys(patch).map((id) => [id, response.values[id] ?? null]));
      await values.mutate((current) => ({ values: { ...current?.values, ...saved } }), { revalidate: false });
      void fetchActivities(workspaceSlug, projectId, workItemId);
    } finally {
      setIsSaving(false);
    }
  };
  return {
    properties: definitions.properties,
    values: values.data?.values ?? {},
    isLoading: definitions.isLoading || values.isLoading,
    error: definitions.error || values.error,
    isSaving,
    save,
    retry: () => Promise.all([definitions.mutate(), values.mutate()]),
  };
};
