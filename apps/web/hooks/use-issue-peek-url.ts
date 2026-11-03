import { useEffect } from "react";
import { reaction } from "mobx";
import { useLocation, useMatches, useNavigate } from "react-router";
import { buildIssuePeekUrl, readIssuePeekUrl } from "@/helpers/issue-peek-url";
import { useIssueDetail } from "./store/use-issue-detail";

export function useIssuePeekUrl() {
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();
  const { workspaceSlug, projectId } = matches.at(-1)?.params ?? {};
  const issueDetail = useIssueDetail();

  useEffect(() => {
    // Notification previews belong to the selected notification, rather than a card deep link.
    if (location.pathname.replace(/\/+$/, "") === `/${workspaceSlug}/notifications`) return;
    const routePeek = readIssuePeekUrl(location.search, workspaceSlug, projectId);
    const current = issueDetail.peekIssue;
    if (
      current?.issueId !== routePeek?.issueId ||
      current?.projectId !== routePeek?.projectId ||
      current?.workspaceSlug !== routePeek?.workspaceSlug ||
      Boolean(current?.isArchived) !== Boolean(routePeek?.isArchived) ||
      current?.nestingLevel !== routePeek?.nestingLevel
    ) {
      issueDetail.setPeekIssue(routePeek);
    }

    // Subscribe after restoring the URL so history navigation never writes another history entry.
    return reaction(
      () => issueDetail.peekIssue,
      (peekIssue) => {
        if (!workspaceSlug || (peekIssue && peekIssue.workspaceSlug !== workspaceSlug)) return;
        const target = buildIssuePeekUrl(location, peekIssue);
        if (target !== `${location.pathname}${location.search}${location.hash}`) {
          void navigate(target, { replace: !peekIssue, preventScrollReset: true });
        }
      }
    );
  }, [location, navigate, workspaceSlug, projectId, issueDetail]);
}
