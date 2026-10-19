/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useTheme } from "next-themes";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssue, TProject } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// assets
import emptyIssueDark from "@/app/assets/empty-state/search/issues-dark.webp?url";
import emptyIssueLight from "@/app/assets/empty-state/search/issues-light.webp?url";
// components
import { EmptyState } from "@/components/common/empty-state";
import { IssueDetailSkeleton } from "@/components/common/loaders/issue-detail-skeleton";
import { PageHead } from "@/components/core/page-title";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// plane web imports
import { useWorkItemProperties } from "@/hooks/use-issue-properties";
import { WorkItemDetailRoot } from "@/components/browse/workItem-detail";

import type { Route } from "./+types/page";

type IssueDetailState = {
  issueId: string | undefined;
  projectId: string;
  issue: TIssue | undefined;
  issueLoader: boolean;
  pageTitle: string | undefined;
};

type WorkItemDetailRoute = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

// helpers
const getIssueDetailState = (
  data: TIssue | undefined,
  isLoading: boolean,
  projectIdentifier: string,
  getIssueById: (issueId: string) => TIssue | undefined,
  getProjectById: (projectId: string | null | undefined) => TProject | undefined,
  getProjectByIdentifier: (projectIdentifier: string) => TProject | undefined
): IssueDetailState => {
  const projectDetails = getProjectByIdentifier(projectIdentifier);
  const issueId = data?.id;
  const projectId = data?.project_id ?? projectDetails?.id ?? "";
  const issue = getIssueById(issueId?.toString() || "") || undefined;
  const project = (issue?.project_id && getProjectById(issue?.project_id)) || undefined;
  const issueLoader = !issue || isLoading;
  const pageTitle = project && issue ? `${project?.identifier}-${issue?.sequence_id} ${issue?.name}` : undefined;

  return { issueId, projectId, issue, issueLoader, pageTitle };
};

const getIssueServiceType = (issue: TIssue | undefined) =>
  issue?.is_epic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES;

const syncIssueDetailSidebar = (
  win: Window,
  issueDetailSidebarCollapsed: boolean | undefined,
  toggleIssueDetailSidebar: (collapsed: boolean) => void
) => {
  if (win.innerWidth < 768) {
    toggleIssueDetailSidebar(true);
    return;
  }
  if (issueDetailSidebarCollapsed) {
    toggleIssueDetailSidebar(false);
  }
};

const getIntakeRedirectPath = (data: TIssue | undefined, workspaceSlug: string) =>
  data?.is_intake
    ? `/${workspaceSlug}/projects/${data.project_id}/intake/?currentTab=open&inboxIssueId=${data.id}`
    : undefined;

const getWorkItemDetailRoute = (
  workspaceSlug: string,
  projectId: string,
  issueId: string | undefined
): WorkItemDetailRoute | null => {
  if (workspaceSlug && projectId && issueId) return { workspaceSlug, projectId, issueId };
  return null;
};

const hasIssueDetailError = (error: Error | undefined, isLoading: boolean) => !!error && !isLoading;

type IssueDetailErrorStateProps = {
  resolvedTheme: string | undefined;
  onGoToAllIssues: () => void;
};

const IssueDetailErrorState = ({ resolvedTheme, onGoToAllIssues }: IssueDetailErrorStateProps) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      image={resolvedTheme === "dark" ? emptyIssueDark : emptyIssueLight}
      title={t("issue.empty_state.issue_detail.title")}
      description={t("issue.empty_state.issue_detail.description")}
      primaryButton={{
        text: t("issue.empty_state.issue_detail.primary_button.text"),
        onClick: onGoToAllIssues,
      }}
    />
  );
};

type WorkItemDetailContainerProps = WorkItemDetailRoute & {
  issue: TIssue | undefined;
};

const WorkItemDetailContainer = ({ workspaceSlug, projectId, issueId, issue }: WorkItemDetailContainerProps) => (
  <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
    <WorkItemDetailRoot workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} issue={issue} />
  </ProjectAuthWrapper>
);

export const IssueDetailsPage = observer(function IssueDetailsPage({ params }: Route.ComponentProps) {
  // router
  const router = useAppRouter();
  const { workspaceSlug, workItem } = params;
  // hooks
  const { resolvedTheme } = useTheme();
  // store hooks
  const {
    fetchIssueWithIdentifier,
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectById, getProjectByIdentifier } = useProject();
  const { toggleIssueDetailSidebar, issueDetailSidebarCollapsed } = useAppTheme();

  const [projectIdentifier, sequence_id] = workItem.split("-");

  // fetching issue details
  const { data, isLoading, error } = useSWR<TIssue, Error>(
    `ISSUE_DETAIL_${workspaceSlug}_${projectIdentifier}_${sequence_id}`,
    () => fetchIssueWithIdentifier(workspaceSlug.toString(), projectIdentifier, sequence_id)
  );

  // derived values
  const { issueId, projectId, issue, issueLoader, pageTitle } = getIssueDetailState(
    data,
    isLoading,
    projectIdentifier,
    getIssueById,
    getProjectById,
    getProjectByIdentifier
  );

  useWorkItemProperties(projectId, workspaceSlug.toString(), issueId, getIssueServiceType(issue));

  useEffect(() => {
    const handleToggleIssueDetailSidebar = () =>
      syncIssueDetailSidebar(window, issueDetailSidebarCollapsed, toggleIssueDetailSidebar);
    window.addEventListener("resize", handleToggleIssueDetailSidebar);
    handleToggleIssueDetailSidebar();
    return () => window.removeEventListener("resize", handleToggleIssueDetailSidebar);
  }, [issueDetailSidebarCollapsed, toggleIssueDetailSidebar]);

  useEffect(() => {
    const intakeRedirectPath = getIntakeRedirectPath(data, workspaceSlug.toString());
    if (intakeRedirectPath) {
      router.push(intakeRedirectPath);
    }
  }, [workspaceSlug, data, router]);

  if (hasIssueDetailError(error, isLoading)) {
    return (
      <IssueDetailErrorState
        resolvedTheme={resolvedTheme}
        onGoToAllIssues={() => router.push(`/${workspaceSlug}/workspace-views/all-issues/`)}
      />
    );
  }

  if (issueLoader) {
    return <IssueDetailSkeleton />;
  }

  const detailRoute = getWorkItemDetailRoute(workspaceSlug, projectId, issueId);

  return (
    <>
      <PageHead title={pageTitle} />
      {detailRoute && <WorkItemDetailContainer {...detailRoute} issue={issue} />}
    </>
  );
});

export default IssueDetailsPage;
