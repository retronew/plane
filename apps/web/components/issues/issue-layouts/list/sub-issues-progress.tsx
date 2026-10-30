import { useEffect } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";

export const SubIssuesProgress = observer(function SubIssuesProgress({
  issueId,
  projectId,
  workspaceSlug,
  total,
}: {
  issueId: string;
  projectId?: string | null;
  workspaceSlug?: string;
  total: number;
}) {
  const { t } = useTranslation();
  const {
    subIssues,
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  const distribution = subIssues.stateDistributionByIssueId(issueId);
  useEffect(() => {
    if (total > 0 && workspaceSlug && projectId && !distribution)
      void subIssues.fetchSubIssues(workspaceSlug, projectId, issueId).catch((error: unknown) => {
        console.error("Failed to load sub-work item progress", error);
      });
  }, [total, workspaceSlug, projectId, issueId, distribution, subIssues]);
  if (total <= 0) return null;
  // Read live states so edits in this list update the ring without refetching the children.
  const completed = distribution
    ? Object.values(distribution)
        .flat()
        .filter((id) => {
          const child = getIssueById(id);
          const state = child?.state_id ? getStateById(child.state_id) : undefined;
          return state ? state.group === "completed" : distribution.completed.includes(id);
        }).length
    : 0;
  const label = t("web.runtime.sub_items_count", { count: total });
  return (
    <Tooltip label={label}>
      <span
        className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-subtle px-2 text-12 text-tertiary"
        aria-label={label}
        data-sub-issues-progress=""
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray={`${distribution ? (completed / total) * 100 : 0} 100`}
            className="text-accent-primary"
          />
        </svg>
        <span>
          {distribution ? completed : "–"}/{total}
        </span>
      </span>
    </Tooltip>
  );
});
