import type { IIssueDisplayFilterOptions, TWorkItemFilterConditionData, TWorkItemFilterExpression } from "@plane/types";

// These additional fields are accepted by the export API's IssueFilterSet.
type ExportCondition = TWorkItemFilterConditionData & {
  is_archived__exact?: boolean;
  is_draft__exact?: boolean;
  parent_id__isnull?: boolean;
};

export function getWorkspaceViewExportFilters(
  viewId: string,
  userId: string,
  filters: TWorkItemFilterExpression = {},
  displayFilters?: IIssueDisplayFilterOptions
): TWorkItemFilterExpression {
  const conditions: ExportCondition[] =
    "and" in filters ? [...filters.and] : Object.keys(filters).length ? [filters] : [];
  conditions.push({ is_archived__exact: false, is_draft__exact: false });
  if (displayFilters?.sub_issue === false) conditions.push({ parent_id__isnull: true });
  if (viewId === "assigned") conditions.push({ assignee_id__in: userId });
  if (viewId === "created") conditions.push({ created_by_id__in: userId });
  if (viewId === "subscribed") conditions.push({ subscriber_id__in: userId });
  return { and: conditions };
}
