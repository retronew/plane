/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useMemo, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { AddOutline, ChevronDownOutline, ChevronRightOutline, CloseOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
// plane imports
import { EUserPermissionsLevel, EDraftIssuePaginationType } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
import { PriorityIcon } from "@plane/blocks/icons";
import { EHeaderVariant, Header } from "@plane/blocks/layout";
import type { TIssuePriorities, TWorkspaceDraftIssue } from "@plane/types";
import { EIssuesStoreType, EUserWorkspaceRoles } from "@plane/types";
// components
import { cn } from "@plane/utils";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceDraftIssues } from "@/hooks/store/workspace-draft";
import { useWorkspaceIssueProperties } from "@/hooks/use-workspace-issue-properties";
// components
import { CreateUpdateIssueModal } from "../issue-modal/modal";
import { DraftIssueBlock } from "./draft-issue-block";
import { filterSortAndGroupDraftIssues, useWorkspaceDraftView } from "./draft-view-context";
import { WorkspaceDraftEmptyState } from "./empty-state";
import { WorkspaceDraftIssuesLoader } from "./loader";

type TWorkspaceDraftIssuesRoot = {
  workspaceSlug: string;
};

export const WorkspaceDraftIssuesRoot = observer(function WorkspaceDraftIssuesRoot(props: TWorkspaceDraftIssuesRoot) {
  const { workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { loader, paginationInfo, fetchIssues, issueIds, getIssueById } = useWorkspaceDraftIssues();
  const { workspaceProjectIds, getProjectById } = useProject();
  const { toggleCreateProjectModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();
  const {
    searchQuery,
    projectIds,
    toggleProjectId,
    priorities,
    togglePriority,
    groupBy,
    sortBy,
    collapsedGroups,
    toggleGroupCollapsed,
    clearFilters,
    clearAll,
    activeFilterCount,
    hasActiveFiltersOrSearch,
  } = useWorkspaceDraftView();
  const [groupDraftPayload, setGroupDraftPayload] = useState<Partial<TWorkspaceDraftIssue> | undefined>(undefined);

  // derived values
  const hasMemberLevelPermission = allowPermissions(
    [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  // swr hook for fetching issue properties
  useWorkspaceIssueProperties(workspaceSlug);

  // fetching issues
  const { isLoading } = useSWR(
    workspaceSlug ? `WORKSPACE_DRAFT_ISSUES_${workspaceSlug}` : null,
    workspaceSlug ? async () => await fetchIssues(workspaceSlug, "init-loader") : null,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  const { filteredIds, groups } = useMemo(
    () =>
      filterSortAndGroupDraftIssues({
        issueIds,
        getIssueById,
        getProjectMeta: (projectId) => {
          const project = projectId ? getProjectById(projectId) : undefined;
          return project ? { name: project.name, identifier: project.identifier } : undefined;
        },
        searchQuery,
        projectIds,
        priorities,
        groupBy,
        sortBy,
      }),
    [issueIds, getIssueById, getProjectById, searchQuery, projectIds, priorities, groupBy, sortBy]
  );

  // handle next issues
  const handleNextIssues = async () => {
    if (!paginationInfo?.next_page_results) return;
    await fetchIssues(workspaceSlug, "pagination", EDraftIssuePaginationType.NEXT);
  };

  if (isLoading) {
    return <WorkspaceDraftIssuesLoader items={14} />;
  }

  if (workspaceProjectIds?.length === 0)
    return (
      <EmptyStateDetailed
        title={t("workspace_projects.empty_state.no_projects.title")}
        description={t("workspace_projects.empty_state.no_projects.description")}
        assetKey="project"
        assetClassName="size-40"
        actions={[
          {
            label: t("workspace_projects.empty_state.no_projects.primary_button.text"),
            onClick: () => {
              toggleCreateProjectModal(true);
            },
            disabled: !hasMemberLevelPermission,
            variant: "primary",
          },
        ]}
      />
    );

  if (issueIds.length <= 0) return <WorkspaceDraftEmptyState />;

  return (
    <div className="relative flex min-h-full flex-col">
      <CreateUpdateIssueModal
        isOpen={Boolean(groupDraftPayload)}
        storeType={EIssuesStoreType.WORKSPACE_DRAFT}
        data={groupDraftPayload}
        onClose={() => setGroupDraftPayload(undefined)}
        isDraft
      />

      {activeFilterCount > 0 && (
        <Header variant={EHeaderVariant.TERNARY} className="min-h-11 bg-surface-1 !px-3">
          <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-layer-1 px-4 py-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {projectIds.map((pid) => {
                const project = getProjectById(pid);
                return (
                  <span
                    key={`project-${pid}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 text-body-xs-regular text-primary"
                  >
                    <ProjectLogo logo={project?.logo_props} size={14} />
                    <span className="max-w-36 truncate">{project?.name ?? pid}</span>
                    <button
                      type="button"
                      aria-label={t("common.remove")}
                      onClick={() => toggleProjectId(pid)}
                      className="inline-flex size-4 cursor-pointer items-center justify-center rounded-xs text-tertiary hover:bg-layer-2 hover:text-primary"
                    >
                      <CloseOutline className="size-3" />
                    </button>
                  </span>
                );
              })}
              {priorities.map((priority) => (
                <span
                  key={`priority-${priority}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 text-body-xs-regular text-primary"
                >
                  <PriorityIcon priority={priority} className="size-3.5 shrink-0" />
                  <span className="capitalize">{t(`common.priorities.${priority}`)}</span>
                  <button
                    type="button"
                    aria-label={t("common.remove")}
                    onClick={() => togglePriority(priority)}
                    className="inline-flex size-4 cursor-pointer items-center justify-center rounded-xs text-tertiary hover:bg-layer-2 hover:text-primary"
                  >
                    <CloseOutline className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <Button variant="secondary" size="sm" stretch="auto" label={t("common.clear_all")} onClick={clearFilters} />
          </div>
        </Header>
      )}

      {filteredIds.length === 0 && hasActiveFiltersOrSearch ? (
        <EmptyStateDetailed
          assetKey="search"
          title={t("common_empty_state.search.title")}
          description={t("common_empty_state.search.description")}
          actions={[
            {
              label: t("common.clear_all"),
              onClick: clearAll,
              variant: "secondary",
            },
          ]}
        />
      ) : groupBy === "none" ? (
        <div className="relative">
          {filteredIds.map((issueId: string) => (
            <DraftIssueBlock key={issueId} workspaceSlug={workspaceSlug} issueId={issueId} />
          ))}
        </div>
      ) : (
        <div className="relative flex flex-col">
          {groups.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]);
            const project = groupBy === "project" ? getProjectById(group.id) : undefined;
            const priority = groupBy === "priority" ? (group.id as TIssuePriorities) : undefined;
            const groupTitle =
              groupBy === "project"
                ? (project?.name ?? t("common.project"))
                : t(`common.priorities.${priority ?? "none"}`);

            return (
              <section key={group.id} data-draft-group={group.id} className="relative flex flex-col">
                <div className="sticky top-0 z-10 flex min-h-10 items-center justify-between gap-2 border-b border-subtle bg-layer-1 px-5 py-1.5">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleGroupCollapsed(group.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    {isCollapsed ? (
                      <ChevronRightOutline className="size-3.5 shrink-0 text-tertiary" />
                    ) : (
                      <ChevronDownOutline className="size-3.5 shrink-0 text-tertiary" />
                    )}
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      {groupBy === "project" ? (
                        <ProjectLogo logo={project?.logo_props} size={16} />
                      ) : (
                        <PriorityIcon priority={priority ?? "none"} className="size-3.5 shrink-0" />
                      )}
                    </span>
                    <span className="truncate text-body-sm-medium text-primary">{groupTitle}</span>
                    <span className="text-13 font-medium text-tertiary tabular-nums">{group.issueIds.length}</span>
                  </button>
                  {hasMemberLevelPermission && (
                    <button
                      type="button"
                      aria-label={t("common.add")}
                      onClick={() =>
                        setGroupDraftPayload(
                          groupBy === "project" && project ? { project_id: project.id } : priority ? { priority } : {}
                        )
                      }
                      className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-tertiary transition-colors hover:bg-layer-2 hover:text-primary"
                    >
                      <AddOutline className="size-3.5" />
                    </button>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="relative">
                    {group.issueIds.map((issueId) => (
                      <DraftIssueBlock key={issueId} workspaceSlug={workspaceSlug} issueId={issueId} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {paginationInfo?.next_page_results && (
        <Fragment>
          {loader === "pagination" && issueIds.length >= 0 ? (
            <WorkspaceDraftIssuesLoader items={1} />
          ) : (
            <button
              type="button"
              className={cn(
                "h-11 w-full border-b border-subtle bg-surface-1 p-3 pl-6 text-left text-13 font-medium transition-all",
                {
                  "cursor-pointer text-accent-primary underline-offset-2 hover:text-accent-secondary hover:underline":
                    paginationInfo?.next_page_results,
                }
              )}
              onClick={handleNextIssues}
            >
              {t("web.load_more")}
            </button>
          )}
        </Fragment>
      )}
    </div>
  );
});
