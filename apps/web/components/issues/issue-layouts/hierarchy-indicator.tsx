import { CornerUpRight, ListTree } from "lucide-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";

/** Relationship information stays visible even when optional task properties are hidden. */
export function IssueHierarchyIndicator({
  parentId,
  parentName,
  subIssuesCount = 0,
}: {
  parentId?: string | null;
  parentName?: string;
  subIssuesCount?: number;
}) {
  const { t } = useTranslation();
  if (!parentId && subIssuesCount <= 0) return null;
  const parentLabel = `${t("common.parent")}${parentName ? ` · ${parentName}` : ""}`;
  const childrenLabel = t("web.runtime.sub_items_count", { count: subIssuesCount });
  return (
    <span
      className="inline-flex min-w-0 shrink-0 items-center gap-2 text-body-xs-regular text-tertiary"
      data-issue-hierarchy=""
    >
      {parentId && (
        <Tooltip label={parentLabel}>
          <span className="inline-flex max-w-40 min-w-0 items-center gap-1" title={parentLabel}>
            <CornerUpRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{parentName || t("common.parent")}</span>
          </span>
        </Tooltip>
      )}
      {subIssuesCount > 0 && (
        <Tooltip label={childrenLabel}>
          <span className="inline-flex shrink-0 items-center gap-1" title={childrenLabel}>
            <ListTree className="size-3 shrink-0" aria-hidden="true" />
            <span>
              {t("common.sub_work_items")} {subIssuesCount}
            </span>
          </span>
        </Tooltip>
      )}
    </span>
  );
}
