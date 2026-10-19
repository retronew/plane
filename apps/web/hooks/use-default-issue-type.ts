import { useEffect } from "react";
import type { TProjectIssueType, TIssue } from "@plane/types";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";

/** Wait for project types before applying the default; preserve existing and explicitly untyped items. */
export function useDefaultIssueType({
  projectId,
  types,
  data,
  getValues,
  setValue,
  getDefault,
}: {
  projectId?: string | null;
  types?: TProjectIssueType[];
  data?: Partial<TIssue>;
  getValues: UseFormGetValues<TIssue>;
  setValue: UseFormSetValue<TIssue>;
  getDefault: (projectId: string) => string | null;
}) {
  useEffect(() => {
    if (!projectId || getValues("type_id") || data?.id || data?.type_id === null) return;
    const id = getDefault(projectId) ?? types?.find((type) => type.is_default && type.is_active)?.id;
    // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent -- react-hook-form setValue seeds the default once; it is not a callback handed to a parent
    if (id) setValue("type_id", id, { shouldValidate: true });
  }, [projectId, types, data, getValues, setValue, getDefault]);
}
