/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { useTheme } from "next-themes";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssue, TProject } from "@plane/types";
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
import { issueSync } from "@/lib/sync/issue-sync";
import { prefetchIssueCollaboration } from "@/services/issue/issue-collaboration.service";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// plane web imports
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
  workItem: string,
  getIssueById: (issueId: string) => TIssue | undefined,
  getIssueIdByIdentifier: (identifier: string) => string | undefined,
  getProjectById: (projectId: string | null | undefined) => TProject | undefined,
  getProjectByIdentifier: (projectIdentifier: string) => TProject | undefined
): IssueDetailState => {
  const projectDetails = getProjectByIdentifier(projectIdentifier);
  const issueId = data?.id ?? getIssueIdByIdentifier(workItem);
  const issue = (issueId && getIssueById(issueId.toString())) || undefined;
  const projectId = data?.project_id ?? issue?.project_id ?? projectDetails?.id ?? "";
  const project = (projectId && getProjectById(projectId)) || undefined;
  const issueLoader = !issue && isLoading;
  const pageTitle = project && issue ? `${project?.identifier}-${issue?.sequence_id} ${issue?.name}` : undefined;

  return { issueId, projectId, issue, issueLoader, pageTitle };
};

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
  snapshotRevision?: number;
};

const WorkItemDetailContainer = ({
  workspaceSlug,
  projectId,
  issueId,
  issue,
  snapshotRevision,
}: WorkItemDetailContainerProps) => (
  <ProjectAuthWrapper
    workspaceSlug={workspaceSlug}
    projectId={projectId}
    loadingFallback={<IssueDetailSkeleton hasParent={!!issue?.parent_id} />}
  >
    <WorkItemDetailRoot
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      issueId={issueId}
      issue={issue}
      snapshotRevision={snapshotRevision}
    />
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
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();
  const { getProjectById, getProjectByIdentifier } = useProject();
  const { toggleIssueDetailSidebar, issueDetailSidebarCollapsed } = useAppTheme();

  const [projectIdentifier, sequence_id] = workItem.split("-");
  const detailKey = `ISSUE_DETAIL_${workspaceSlug}_${projectIdentifier}_${sequence_id}`;
  const snapshotRevisionsRef = useRef(new Map<string, number>());

  // fetching issue details
  const { data, isLoading, error } = useSWR<TIssue, Error>(
    detailKey,
    () => {
      snapshotRevisionsRef.current.set(detailKey, issueSync.snapshotRevision);
      return fetchIssueWithIdentifier(workspaceSlug.toString(), projectIdentifier, sequence_id);
    },
    { revalidateOnFocus: false }
  );

  // derived values
  const { issueId, projectId, issue, issueLoader, pageTitle } = getIssueDetailState(
    data,
    isLoading,
    projectIdentifier,
    workItem,
    getIssueById,
    getIssueIdByIdentifier,
    getProjectById,
    getProjectByIdentifier
  );

  const knownIssueId = issueId;
  useEffect(() => {
    if (projectId && knownIssueId && !issue?.archived_at) {
      prefetchIssueCollaboration(workspaceSlug.toString(), projectId, knownIssueId);
    }
  }, [workspaceSlug, projectId, knownIssueId, issue?.archived_at]);

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

  useEffect(() => {
    if (issue?.archived_at && issue.project_id) {
      router.replace(`/${workspaceSlug}/projects/${issue.project_id}/archives/issues/${issue.id}/`);
    }
  }, [issue?.archived_at, issue?.project_id, issue?.id, router, workspaceSlug]);

  if (hasIssueDetailError(error, isLoading) || (data && !issue && !isLoading)) {
    return (
      <IssueDetailErrorState
        resolvedTheme={resolvedTheme}
        onGoToAllIssues={() => router.push(`/${workspaceSlug}/workspace-views/all-issues/`)}
      />
    );
  }

  if (issueLoader || !issue) {
    return <IssueDetailSkeleton hasParent={!!issue?.parent_id} />;
  }

  const detailRoute = getWorkItemDetailRoute(workspaceSlug, projectId, issueId);
  if (data && !snapshotRevisionsRef.current.has(detailKey)) {
    snapshotRevisionsRef.current.set(detailKey, issueSync.snapshotRevision);
  }
  const snapshotRevision = snapshotRevisionsRef.current.get(detailKey);

  return (
    <>
      <PageHead title={pageTitle} />
      {detailRoute && <WorkItemDetailContainer {...detailRoute} issue={issue} snapshotRevision={snapshotRevision} />}
    </>
  );
});

export default IssueDetailsPage;
