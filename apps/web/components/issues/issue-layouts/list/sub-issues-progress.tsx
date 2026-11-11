import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";

export const SubIssuesProgress = observer(function SubIssuesProgress({
  issueId,
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
  if (total <= 0) return null;
  const authoritativeCount = getIssueById(issueId)?.completed_sub_issues_count;
  let completed: number | undefined;
  if (typeof authoritativeCount === "number" && Number.isFinite(authoritativeCount)) {
    completed = Math.min(Math.max(authoritativeCount, 0), total);
  } else {
    // Legacy entities may omit the count. Never use cached distribution groups as
    // state truth or fetch an unbounded children list for each visible parent.
    const distribution = subIssues.stateDistributionByIssueId(issueId);
    const childIds = distribution ? [...new Set(Object.values(distribution).flat())] : [];
    const states = childIds.map((id) => {
      const child = getIssueById(id);
      return child?.state_id ? getStateById(child.state_id) : undefined;
    });
    if (childIds.length === total && states.every((state) => !!state)) {
      completed = states.filter((state) => state?.group === "completed").length;
    }
  }
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
            strokeDasharray={`${((completed ?? 0) / total) * 100} 100`}
            className="text-accent-primary"
          />
        </svg>
        <span>
          {completed ?? "–"}/{total}
        </span>
      </span>
    </Tooltip>
  );
});
