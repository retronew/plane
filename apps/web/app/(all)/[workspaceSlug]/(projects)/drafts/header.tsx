/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { observer } from "mobx-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Button } from "@makeplane/propel/components/button";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ChevronDownOutline, DraftsOutline, TickOutline } from "@makeplane/propel/icons";
import { EIssuesStoreType } from "@plane/types";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
import { PriorityIcon } from "@plane/blocks/icons";
import { Header } from "@plane/blocks/layout";
import { MenuPanel, MenuRow, MenuSearchInput } from "@plane/blocks/select";
import { cn } from "@plane/utils";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { CountChip } from "@/components/common/count-chip";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
import {
  composerCacheKey,
  composerDraftContext,
  readComposerDraft,
  subscribeComposerDrafts,
} from "@/components/issues/issue-modal/composer-cache";
import { DRAFT_PRIORITY_ORDER, useWorkspaceDraftView } from "@/components/issues/workspace-draft/draft-view-context";
import type { TDraftGroupBy, TDraftSortBy } from "@/components/issues/workspace-draft/draft-view-context";

// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceDraftIssues } from "@/hooks/store/workspace-draft";

export const WorkspaceDraftHeader = observer(function WorkspaceDraftHeader() {
  // state
  const [isDraftIssueModalOpen, setIsDraftIssueModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const { workspaceSlug } = useParams();
  const { data: currentUser } = useUser();
  const hasPendingDraft = useSyncExternalStore(
    subscribeComposerDrafts,
    () =>
      !!(
        currentUser?.id &&
        workspaceSlug &&
        readComposerDraft(
          composerCacheKey(currentUser.id, workspaceSlug.toString(), composerDraftContext(undefined, undefined, true))
        )
      ),
    () => false
  );
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { paginationInfo, issueIds, getIssueById } = useWorkspaceDraftIssues();
  const { joinedProjectIds, getProjectById } = useProject();
  const {
    searchQuery,
    setSearchQuery,
    projectIds,
    toggleProjectId,
    priorities,
    togglePriority,
    groupBy,
    setGroupBy,
    sortBy,
    setSortBy,
    clearFilters,
    activeFilterCount,
  } = useWorkspaceDraftView();

  const { t } = useTranslation();
  // check if user is authorized to create draft work item
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  // Projects present in current drafts (plus selected ones) for quick filtering
  const draftProjects = useMemo(() => {
    const idSet = new Set<string>(projectIds);
    for (const id of issueIds) {
      const pid = getIssueById(id)?.project_id;
      if (pid) idSet.add(pid);
    }
    return [...idSet]
      .map((id) => getProjectById(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [issueIds, projectIds, getIssueById, getProjectById]);

  const normalizedFilterSearch = filterSearch.trim().toLowerCase();
  const visibleProjects = draftProjects.filter(
    (project) =>
      !normalizedFilterSearch || `${project.name} ${project.identifier}`.toLowerCase().includes(normalizedFilterSearch)
  );
  const visiblePriorities = DRAFT_PRIORITY_ORDER.filter(
    (priority) =>
      !normalizedFilterSearch ||
      t(`common.priorities.${priority}`).toLowerCase().includes(normalizedFilterSearch) ||
      priority.includes(normalizedFilterSearch)
  );

  const groupOptions: { key: TDraftGroupBy; label: string }[] = [
    { key: "project", label: t("common.project") },
    { key: "priority", label: t("common.priority") },
    { key: "none", label: t("common.none") },
  ];

  const sortOptions: { key: TDraftSortBy; label: string }[] = [
    { key: "updated_at", label: t("common.order_by.last_updated") },
    { key: "created_at", label: t("common.order_by.last_created") },
    { key: "name", label: t("common.title") },
    { key: "priority", label: t("common.priority") },
  ];

  const activeGroupLabel = groupOptions.find((opt) => opt.key === groupBy)?.label ?? t("common.project");
  const activeSortLabel = sortOptions.find((opt) => opt.key === sortBy)?.label ?? t("common.order_by.last_updated");

  return (
    <>
      <CreateUpdateIssueModal
        isOpen={isDraftIssueModalOpen}
        storeType={EIssuesStoreType.WORKSPACE_DRAFT}
        onClose={() => setIsDraftIssueModalOpen(false)}
        isDraft
      />
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2.5">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink label={t("drafts")} icon={<DraftsOutline className="h-4 w-4 text-tertiary" />} />
                }
              />
            </Breadcrumbs>
            {paginationInfo?.total_count && paginationInfo?.total_count > 0 ? (
              <CountChip count={paginationInfo?.total_count} />
            ) : (
              <></>
            )}
          </div>
        </Header.LeftItem>

        <Header.RightItem>
          {issueIds.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex">
              <ExpandableSearch
                size="md"
                aria-label={t("common.search.label")}
                placeholder={t("common.search.label")}
                clearLabel={t("common.clear")}
                value={searchQuery}
                onValueChange={(value) => setSearchQuery(value ?? "")}
              />

              {/* Group by menu */}
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="md"
                      stretch="auto"
                      label={`${t("common.group_by")}: ${activeGroupLabel}`}
                      appendIcon={<ChevronDownOutline className="size-3.5 text-tertiary" />}
                    />
                  }
                />
                <MenuContent side="bottom" align="end">
                  <div className="min-w-40">
                    {groupOptions.map((opt) => (
                      <MenuItem
                        key={opt.key}
                        label={opt.label}
                        trailing={groupBy === opt.key ? <TickOutline className="size-3.5 text-accent-primary" /> : null}
                        onClick={() => setGroupBy(opt.key)}
                      />
                    ))}
                  </div>
                </MenuContent>
              </Menu>

              {/* Sort by menu */}
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="md"
                      stretch="auto"
                      label={activeSortLabel}
                      appendIcon={<ChevronDownOutline className="size-3.5 text-tertiary" />}
                    />
                  }
                />
                <MenuContent side="bottom" align="end">
                  <div className="min-w-40">
                    {sortOptions.map((opt) => (
                      <MenuItem
                        key={opt.key}
                        label={opt.label}
                        trailing={sortBy === opt.key ? <TickOutline className="size-3.5 text-accent-primary" /> : null}
                        onClick={() => setSortBy(opt.key)}
                      />
                    ))}
                  </div>
                </MenuContent>
              </Menu>

              {/* Single-surface multi-select filter popover */}
              <BasePopover.Root
                open={isFilterOpen}
                onOpenChange={(next) => {
                  setIsFilterOpen(next);
                  if (!next) setFilterSearch("");
                }}
              >
                <Tooltip label={t("common.filters")} side="bottom">
                  <BasePopover.Trigger
                    render={
                      <FilterToggleButton
                        size="md"
                        active={activeFilterCount > 0}
                        count={activeFilterCount}
                        aria-label={t("common.filters")}
                      />
                    }
                  />
                </Tooltip>
                <BasePopover.Portal>
                  <BasePopover.Positioner
                    side="bottom"
                    align="end"
                    sideOffset={4}
                    collisionPadding={16}
                    className="z-60"
                  >
                    <BasePopover.Popup
                      aria-label={t("common.filters")}
                      render={<MenuPanel flush className="flex max-h-96 w-64 flex-col overflow-hidden" />}
                    >
                      <MenuSearchInput
                        placeholder={t("common.search.label")}
                        value={filterSearch}
                        onChange={setFilterSearch}
                      />
                      <div className="min-h-0 flex-1 overflow-y-auto p-1">
                        {visibleProjects.length > 0 && (
                          <div className="mb-1">
                            <p className="px-2 py-1 text-caption-md-medium text-tertiary">{t("common.project")}</p>
                            {visibleProjects.map((project) => {
                              const selected = projectIds.includes(project.id);
                              return (
                                <MenuRow
                                  key={project.id}
                                  render={<button type="button" aria-label={project.name} />}
                                  onClick={() => toggleProjectId(project.id)}
                                  className="h-8 text-body-xs-regular text-primary"
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <ProjectLogo logo={project.logo_props} size={14} />
                                    <span className="truncate">{project.name}</span>
                                  </span>
                                  {selected && <TickOutline className="size-3.5 shrink-0 text-accent-primary" />}
                                </MenuRow>
                              );
                            })}
                          </div>
                        )}

                        {visiblePriorities.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-caption-md-medium text-tertiary">{t("common.priority")}</p>
                            {visiblePriorities.map((priority) => {
                              const selected = priorities.includes(priority);
                              return (
                                <MenuRow
                                  key={priority}
                                  render={<button type="button" aria-label={t(`common.priorities.${priority}`)} />}
                                  onClick={() => togglePriority(priority)}
                                  className="h-8 text-body-xs-regular text-primary"
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <PriorityIcon priority={priority} className="size-3.5 shrink-0" />
                                    <span className="truncate capitalize">{t(`common.priorities.${priority}`)}</span>
                                  </span>
                                  {selected && <TickOutline className="size-3.5 shrink-0 text-accent-primary" />}
                                </MenuRow>
                              );
                            })}
                          </div>
                        )}

                        {visibleProjects.length === 0 && visiblePriorities.length === 0 && (
                          <p className="px-2 py-3 text-center text-body-xs-regular text-tertiary">
                            {t("common.search.no_matching_results")}
                          </p>
                        )}
                      </div>
                      {activeFilterCount > 0 && (
                        <div className={cn("border-t border-subtle p-1.5")}>
                          <Button
                            variant="ghost"
                            size="sm"
                            stretch="fill"
                            label={t("common.clear_all")}
                            onClick={clearFilters}
                          />
                        </div>
                      )}
                    </BasePopover.Popup>
                  </BasePopover.Positioner>
                </BasePopover.Portal>
              </BasePopover.Root>
            </div>
          )}

          {joinedProjectIds && joinedProjectIds.length > 0 && (
            <span className="relative inline-flex">
              <Button
                data-draft-work-item-trigger=""
                variant="primary"
                size="md"
                stretch="auto"
                label={t("workspace_draft_issues.draft_an_issue")}
                onClick={() => setIsDraftIssueModalOpen(true)}
                disabled={!isAuthorizedUser}
              />
              {hasPendingDraft && !isDraftIssueModalOpen && (
                <span
                  data-draft-composer-indicator=""
                  title={t("workspace_draft_issues.temporarily_saved")}
                  className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-inverse"
                >
                  <span className="sr-only">{t("workspace_draft_issues.temporarily_saved")}</span>
                </span>
              )}
            </span>
          )}
        </Header.RightItem>
      </Header>
    </>
  );
});
