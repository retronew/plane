/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { hierarchyErrorKey } from "@/helpers/issue-hierarchy";
import { useEffect, useState, useRef } from "react";
import { Combobox, ComboboxItem, ComboboxList, ComboboxSearch } from "@makeplane/propel/components/combobox";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogInfo,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { NewTabOutline } from "@makeplane/propel/icons";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { ISearchIssueResponse, TProjectIssuesSearchParams } from "@plane/types";
// ui
import { Switch } from "@makeplane/propel/components/switch";
import { Loader } from "@plane/blocks/skeleton";
import { generateWorkItemLink, getTabIndex } from "@plane/utils";
// helpers
// hooks
import useDebounce from "@/hooks/use-debounce";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { ProjectService } from "@/services/project";
// components
import { IssueSearchModalEmptyState } from "./issue-search-modal-empty-state";
import { ExistingIssuesFilters, emptyExistingIssueFilters } from "./existing-issues-filters";
import type { ExistingIssueFilters } from "./existing-issues-filters";

type Props = {
  workspaceSlug: string | undefined;
  projectId?: string;
  isOpen: boolean;
  handleClose: () => void;
  searchParams: Partial<TProjectIssuesSearchParams>;
  handleOnSubmit: (data: ISearchIssueResponse[]) => Promise<void>;
  workspaceLevelToggle?: boolean;
  shouldHideIssue?: (issue: ISearchIssueResponse) => boolean;
  selectedWorkItemIds?: string[];
  workItemSearchServiceCallback?: (params: TProjectIssuesSearchParams) => Promise<ISearchIssueResponse[]>;
};

const projectService = new ProjectService();

function candidateSearchKey(params: Props["searchParams"], filters: ExistingIssueFilters) {
  if (params.cycle !== true) return JSON.stringify(params);
  return JSON.stringify({
    ...params,
    ...(filters.state_group.length ? { state_group: filters.state_group.join(",") } : {}),
    ...(filters.priority.length ? { priority: filters.priority.join(",") } : {}),
    ...(filters.start_date.length ? { start_date: filters.start_date.join(",") } : {}),
    ...(filters.target_date.length ? { target_date: filters.target_date.join(",") } : {}),
  });
}

export function ExistingIssuesListModal(props: Props) {
  const { t } = useTranslation();

  const {
    workspaceSlug,
    projectId,
    isOpen,
    handleClose: onClose,
    searchParams,
    handleOnSubmit,
    workspaceLevelToggle = false,
    shouldHideIssue,
    selectedWorkItemIds,
    workItemSearchServiceCallback,
  } = props;
  // states
  const [searchTerm, setSearchTerm] = useState("");
  const [selection, setSelectedIssues] = useState<ISearchIssueResponse[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkspaceLevel, setIsWorkspaceLevel] = useState(false);
  const { isMobile } = usePlatformOS();
  const debouncedQuery: string = useDebounce(searchTerm, 500);
  // A completed close clears the query synchronously, including a quick reopen before debounce settles.
  const debouncedSearchTerm = searchTerm === "" ? "" : debouncedQuery;
  const { baseTabIndex } = getTabIndex(undefined, isMobile);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [candidateFilters, setCandidateFilters] = useState(emptyExistingIssueFilters);
  const canFilter = searchParams.cycle === true;
  const searchParamsKey = candidateSearchKey(searchParams, candidateFilters);
  const { issues, isLoading, isSearching, searchFailed, invalidateSearch, cancelPendingSearch, resetSearch } =
    useExistingIssuesSearch({
      isOpen,
      workspaceSlug,
      projectId,
      searchParamsKey,
      debouncedSearchTerm,
      isWorkspaceLevel,
      workItemSearchServiceCallback,
      retry,
    });
  const selectedIdSet = new Set(selectedWorkItemIds);
  const selectedIssues = selection ?? issues.filter((issue) => selectedIdSet.has(issue.id));

  const close = () => {
    cancelPendingSearch();
    onClose();
  };
  const handleClose = () => {
    if (!isSubmitting) close();
  };
  const handleOpenChangeComplete = (open: boolean) => {
    if (open || isOpen) return;
    resetSearch();
    setSaveError(null);
    setSearchTerm("");
    setSelectedIssues(null);
    setIsWorkspaceLevel(false);
    setCandidateFilters(emptyExistingIssueFilters());
  };

  const onSubmit = () =>
    submitSelection(
      selectedIssues,
      handleOnSubmit,
      searchParams.sub_issue === true,
      t,
      setIsSubmitting,
      setSaveError,
      close
    );

  const filteredIssues = issues.filter((issue) => !shouldHideIssue?.(issue));
  const visibleIds = new Set(filteredIssues.map((issue) => issue.id));
  const selectedIds = new Set(selectedIssues.map((issue) => issue.id));
  const allVisibleSelected = filteredIssues.length > 0 && filteredIssues.every((issue) => selectedIds.has(issue.id));
  const handleSelectIssues = () => {
    setSelectedIssues(
      allVisibleSelected
        ? selectedIssues.filter((issue) => !visibleIds.has(issue.id))
        : [...selectedIssues, ...filteredIssues.filter((issue) => !selectedIds.has(issue.id))]
    );
  };

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal
      onOpenChangeComplete={handleOpenChangeComplete}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        {/* The search field is the only visible chrome, so the dialog's accessible name is carried
            by a visually hidden title. */}
        <div className="sr-only">
          <DialogTitle>{t("issue.add.existing")}</DialogTitle>
        </div>
        {/* `inline` + `open` renders the list in place: the dialog is the surface, so there is no
            popup positioner. */}
        <Combobox<ISearchIssueResponse, true>
          inline
          multiple
          // Dialog owns mounting and exit animation; keep inline rows visible until it unmounts.
          open
          // Inline list visibility belongs to the dialog. Outside presses and input blur from
          // filter popovers must not dismiss the enclosing modal; Dialog handles Escape itself.
          value={selectedIssues}
          onValueChange={(next) => {
            if (!isSubmitting && !isSearching && !isLoading) setSelectedIssues(next);
          }}
          // Re-searching returns fresh objects, so rows are matched to the selection by id.
          isItemEqualToValue={(itemValue, value) => itemValue.id === value.id}
          itemToStringLabel={(issue) => issue.name}
          inputValue={searchTerm}
          onInputValueChange={(next, details) => {
            // Base UI clears the query after every pick in multiple mode; letting that through
            // would re-run the debounced server search on each toggle.
            if (details.reason === "input-clear" || next === searchTerm) return;
            invalidateSearch();
            setSearchTerm(next);
          }}
        >
          {canFilter ? (
            <ExistingIssuesFilters
              value={candidateFilters}
              onChange={(next) => {
                setSelectedIssues(selectedIssues);
                invalidateSearch();
                setCandidateFilters(next);
              }}
            >
              <ComboboxSearch
                placeholder={t("common.search.placeholder")}
                aria-label={t("issue.add.existing")}
                tabIndex={baseTabIndex}
              />
            </ExistingIssuesFilters>
          ) : (
            <ComboboxSearch
              placeholder={t("common.search.placeholder")}
              aria-label={t("issue.add.existing")}
              tabIndex={baseTabIndex}
            />
          )}
          <DialogMain render={<div className="gap-2! px-3! py-2!" />}>
            {saveError && (
              <p role="alert" className="text-13 text-danger-primary">
                {t(saveError)}
              </p>
            )}
            {searchFailed && (
              <div role="alert" className="py-3 text-13">
                <p>{t("web.issue_hierarchy.search_failed")}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  stretch="auto"
                  label={t("web.retry")}
                  onClick={() => setRetry((attempt) => attempt + 1)}
                />
              </div>
            )}
            {workspaceLevelToggle && (
              <WorkspaceLevelToggle
                checked={isWorkspaceLevel}
                onCheckedChange={setIsWorkspaceLevel}
                isMobile={isMobile}
              />
            )}

            <ExistingIssuesSearchResults
              workspaceSlug={workspaceSlug}
              searchTerm={searchTerm}
              debouncedSearchTerm={debouncedSearchTerm}
              isSearching={isSearching || isSubmitting}
              isLoading={isLoading}
              searchFailed={searchFailed}
              filteredIssues={filteredIssues}
            />
          </DialogMain>
        </Combobox>
        <DialogActions render={<div className="px-3! pt-2! pb-3!" />}>
          <DialogInfo>
            <Button
              variant="ghost"
              size="sm"
              stretch="auto"
              label={allVisibleSelected ? t("issue.select.deselect_all") : t("issue.select.select_all")}
              onClick={handleSelectIssues}
              disabled={isSubmitting || isSearching || isLoading || filteredIssues.length === 0}
            />
          </DialogInfo>
          <Button variant="secondary" size="md" stretch="auto" label={t("common.cancel")} onClick={handleClose} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={isSubmitting ? t("common.adding") : t("issue.select.add_selected")}
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || selectedIssues.length === 0}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceLevelToggle({
  checked,
  onCheckedChange,
  isMobile,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end text-13 text-secondary">
      <Tooltip label={t("web.toggle_workspace_level_search")} disabled={isMobile}>
        <div
          className={`flex flex-shrink-0 cursor-pointer items-center gap-1 text-11 ${
            checked ? "text-primary" : "text-secondary"
          }`}
        >
          <Switch
            size="md"
            checked={checked}
            onCheckedChange={onCheckedChange}
            aria-label={t("common.workspace_level")}
          />
          <button type="button" onClick={() => onCheckedChange(!checked)} className="flex-shrink-0">
            {t("common.workspace_level")}
          </button>
        </div>
      </Tooltip>
    </div>
  );
}

function useExistingIssuesSearch({
  isOpen,
  workspaceSlug,
  projectId,
  searchParamsKey,
  debouncedSearchTerm,
  isWorkspaceLevel,
  workItemSearchServiceCallback,
  retry,
}: {
  isOpen: boolean;
  workspaceSlug?: string;
  projectId?: string;
  searchParamsKey: string;
  debouncedSearchTerm: string;
  isWorkspaceLevel: boolean;
  workItemSearchServiceCallback?: Props["workItemSearchServiceCallback"];
  retry: number;
}) {
  const requestGeneration = useRef(0);
  const [issues, setIssues] = useState<ISearchIssueResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  useEffect(() => {
    if (!isOpen || !workspaceSlug) return;
    const generation = ++requestGeneration.current;
    const searchService =
      workItemSearchServiceCallback ??
      (projectId ? projectService.projectIssuesSearch.bind(projectService, workspaceSlug, projectId) : undefined);
    if (!searchService) return;
    // Keep the previous rows mounted while refreshing to avoid replacing the list with a skeleton.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLoading(true);
    setIsSearching(true);
    setSearchFailed(false);
    const params = JSON.parse(searchParamsKey) as Partial<TProjectIssuesSearchParams>;
    searchService({ search: debouncedSearchTerm, ...params, workspace_search: isWorkspaceLevel })
      .then((res) => {
        if (generation === requestGeneration.current) setIssues(res);
        return undefined;
      })
      .catch(() => {
        if (generation === requestGeneration.current) setSearchFailed(true);
      })
      .finally(() => {
        if (generation !== requestGeneration.current) return;
        setIsSearching(false);
        setIsLoading(false);
      });
    return () => {
      // This ref is a request counter, not a DOM node; invalidate the current generation on cleanup.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      requestGeneration.current++;
    };
    // retry intentionally restarts the same request after an error.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [
    debouncedSearchTerm,
    isOpen,
    isWorkspaceLevel,
    projectId,
    workspaceSlug,
    searchParamsKey,
    workItemSearchServiceCallback,
    retry,
  ]);
  return {
    issues,
    isLoading,
    isSearching,
    searchFailed,
    invalidateSearch: () => {
      requestGeneration.current++;
      setIsSearching(true);
    },
    cancelPendingSearch: () => {
      requestGeneration.current++;
    },
    resetSearch: () => {
      requestGeneration.current++;
      setIssues([]);
      setIsLoading(false);
      setIsSearching(false);
      setSearchFailed(false);
    },
  };
}

async function submitSelection(
  selectedIssues: ISearchIssueResponse[],
  submit: Props["handleOnSubmit"],
  isSubIssue: boolean,
  t: (key: string) => string,
  setSubmitting: (value: boolean) => void,
  setError: (value: string | null) => void,
  onSuccess: () => void
) {
  if (!selectedIssues.length) {
    setToast({ type: "error", title: t("toast.error"), message: t("issue.select.error") });
    return;
  }
  setSubmitting(true);
  setError(null);
  try {
    await submit(selectedIssues);
    onSuccess();
  } catch (error) {
    setError(isSubIssue ? hierarchyErrorKey(error) : "common.something_went_wrong");
  } finally {
    setSubmitting(false);
  }
}

function ExistingIssuesSearchResults({
  workspaceSlug,
  searchTerm,
  debouncedSearchTerm,
  isSearching,
  isLoading,
  searchFailed,
  filteredIssues,
}: {
  workspaceSlug?: string;
  searchTerm: string;
  debouncedSearchTerm: string;
  isSearching: boolean;
  isLoading: boolean;
  searchFailed: boolean;
  filteredIssues: ISearchIssueResponse[];
}) {
  const { t } = useTranslation();
  return (
    <div
      aria-busy={isSearching || isLoading}
      className="vertical-scrollbar scrollbar-md max-h-80 min-h-0 scroll-py-2 overflow-x-hidden overflow-y-auto overscroll-contain [&_[role=option]]:h-10! [&_[role=option]]:min-h-10! [&_[role=option]]:text-body-sm-regular"
    >
      {/* TODO: Translate here */}
      {searchTerm !== "" && (
        <h5 className="text-13 text-secondary">
          <Translation
            translationKey="web.ui.project_search_results"
            components={{ query: <span className="text-primary">{searchTerm}</span> }}
          />
        </h5>
      )}

      {(isSearching || isLoading) && filteredIssues.length === 0 ? (
        <Loader className="space-y-3 p-3">
          <Loader.Item height="40px" />
          <Loader.Item height="40px" />
          <Loader.Item height="40px" />
          <Loader.Item height="40px" />
        </Loader>
      ) : (
        <>
          {searchFailed ? null : filteredIssues.length === 0 ? (
            <IssueSearchModalEmptyState
              debouncedSearchTerm={debouncedSearchTerm}
              isSearching={isSearching}
              issues={filteredIssues}
              searchTerm={searchTerm}
            />
          ) : (
            <ComboboxList aria-label={t("issue.add.existing")}>
              {filteredIssues.map((issue) => (
                // `selection="checkbox"` replaces the hand-placed checkbox and the
                // `as="label"` wrapper the old row needed to make it clickable.
                <ComboboxItem
                  key={issue.id}
                  value={issue}
                  selection="checkbox"
                  disabled={isSearching || isLoading}
                  label={issue.name}
                  icon={
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span
                        className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor: issue.state__color,
                        }}
                      />
                      <span className="shrink-0 text-body-xs-regular text-secondary">
                        {issue.project__identifier}-{issue.sequence_id}
                      </span>
                    </span>
                  }
                  trailing={
                    <Tooltip label={t("common.actions.open_in_new_tab")}>
                      <a
                        href={generateWorkItemLink({
                          workspaceSlug,
                          projectId: issue?.project_id,
                          issueId: issue?.id,
                          projectIdentifier: issue.project__identifier,
                          sequenceId: issue?.sequence_id,
                        })}
                        target="_blank"
                        className="relative z-1 flex-shrink-0 text-secondary opacity-0 group-hover/item:opacity-100 hover:text-primary focus:opacity-100"
                        rel="noopener noreferrer"
                        aria-label={t("common.actions.open_in_new_tab")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <NewTabOutline className="h-4 w-4" />
                      </a>
                    </Tooltip>
                  }
                />
              ))}
            </ComboboxList>
          )}
        </>
      )}
    </div>
  );
}
