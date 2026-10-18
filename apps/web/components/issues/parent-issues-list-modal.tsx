/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { hierarchyErrorKey, hierarchyTypeSearchParam } from "@/helpers/issue-hierarchy";
import { useParams } from "next/navigation";
// icons
import { RocketOutline } from "@makeplane/propel/icons";
// propel
import { Combobox, ComboboxItem, ComboboxList, ComboboxSearch } from "@makeplane/propel/components/combobox";
import { Dialog, DialogContent, DialogMain, DialogTitle } from "@makeplane/propel/components/dialog";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import type { ISearchIssueResponse } from "@plane/types";
// ui
import { Loader } from "@plane/blocks/skeleton";
import { generateWorkItemLink, getTabIndex } from "@plane/utils";
// components
import { IssueSearchModalEmptyState } from "@/components/core/modals/issue-search-modal-empty-state";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import useDebounce from "@/hooks/use-debounce";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { ProjectService } from "@/services/project";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  value?: any;
  onChange: (issue: ISearchIssueResponse) => void | Promise<void>;
  typeId?: string | null;
  projectId: string | undefined;
  issueId?: string;
  searchEpic?: boolean;
};

// services
const projectService = new ProjectService();

export function ParentIssuesListModal({
  isOpen,
  handleClose: onClose,
  value,
  onChange,
  projectId,
  issueId,
  typeId,
  searchEpic = false,
}: Props) {
  // i18n
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [issues, setIssues] = useState<ISearchIssueResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const requestGeneration = useRef(0);
  const { isMobile } = usePlatformOS();
  const debouncedSearchTerm: string = useDebounce(searchTerm, 500);

  const { workspaceSlug } = useParams();

  const { baseTabIndex } = getTabIndex(undefined, isMobile);
  // derived values
  const selectedIssueId = selectedId ?? (typeof value?.id === "string" ? value.id : null);

  const handleClose = () => {
    if (isSaving) return;
    requestGeneration.current++;
    onClose();
    setSearchTerm("");
    setSelectedId(null);
    setSaveError(null);
  };

  const selectParent = async (id: string | null) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue || isSaving) return;
    setSelectedId(issue.id);
    setSaveError(null);
    setIsSaving(true);
    try {
      await onChange(issue);
      onClose();
      setSearchTerm("");
      setSelectedId(null);
    } catch (error) {
      setSaveError(hierarchyErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !workspaceSlug || !projectId) return;

    const generation = ++requestGeneration.current;
    // Search context changed: mark the asynchronous request pending and discard stale candidates.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsSearching(true);
    setIsLoading(true);
    setSearchFailed(false);
    setIssues([]);

    projectService
      .projectIssuesSearch(workspaceSlug, projectId, {
        search: debouncedSearchTerm,
        parent: searchEpic ? undefined : true,
        issue_id: issueId,
        type_id: hierarchyTypeSearchParam(typeId),
        workspace_search: false,
        epic: searchEpic ? true : undefined,
      })
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
  }, [debouncedSearchTerm, isOpen, issueId, projectId, searchEpic, typeId, workspaceSlug, retry]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        {/* The search field is the only visible chrome, so the dialog's accessible name is carried by a visually hidden title. */}
        <div className="sr-only">
          <DialogTitle>{t("issue.add.parent")}</DialogTitle>
        </div>
        <Combobox<string, false>
          inline
          open={isOpen}
          items={issues}
          filter={null}
          inputValue={searchTerm}
          onInputValueChange={(next, details) => {
            // Base UI also reports its own clears (on item press, on close); only a keystroke
            // should move the server-side search.
            if (details.reason !== "input-change") return;
            requestGeneration.current++;
            setIssues([]);
            setIsSearching(true);
            setSearchTerm(next);
          }}
          value={selectedIssueId}
          onValueChange={(id) => void selectParent(id)}
          disabled={isSaving}
        >
          <ComboboxSearch placeholder={t("common.search.placeholder")} tabIndex={baseTabIndex} />
          <DialogMain>
            {saveError && (
              <p role="alert" className="px-3 text-13 text-danger-primary">
                {t(saveError)}
              </p>
            )}
            {searchFailed && (
              <div role="alert" className="p-3 text-13">
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
            <div className="vertical-scrollbar scrollbar-md max-h-80 scroll-py-2 overflow-x-hidden overflow-y-auto overscroll-contain">
              {searchTerm !== "" && (
                <h5 className="mx-2 text-13 text-secondary">
                  <Translation
                    translationKey="web.ui.project_search_results"
                    components={{ query: <span className="text-primary">{searchTerm}</span> }}
                  />
                </h5>
              )}

              {isSearching || isLoading ? (
                <Loader className="space-y-3 p-3">
                  <Loader.Item height="40px" />
                  <Loader.Item height="40px" />
                  <Loader.Item height="40px" />
                  <Loader.Item height="40px" />
                </Loader>
              ) : (
                <>
                  {searchFailed ? null : issues.length === 0 ? (
                    <IssueSearchModalEmptyState
                      debouncedSearchTerm={debouncedSearchTerm}
                      isSearching={isSearching}
                      issues={issues}
                      searchTerm={searchTerm}
                    />
                  ) : (
                    <ComboboxList aria-label={t("common.search.placeholder")}>
                      {(issue: ISearchIssueResponse, index: number) => (
                        <ComboboxItem
                          key={issue.id}
                          value={issue.id}
                          index={index}
                          label={issue.name}
                          icon={
                            <span className="flex shrink-0 items-center gap-2">
                              <span
                                className="block h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: issue.state__color,
                                }}
                              />
                              <IssueIdentifier
                                projectId={issue.project_id}
                                issueTypeId={issue.type_id}
                                projectIdentifier={issue.project__identifier}
                                issueSequenceId={issue.sequence_id}
                                size="xs"
                                variant="secondary"
                              />
                            </span>
                          }
                          trailing={
                            <a
                              href={generateWorkItemLink({
                                workspaceSlug: workspaceSlug?.toString() ?? "",
                                projectId: issue?.project_id,
                                issueId: issue?.id,
                                projectIdentifier: issue.project__identifier,
                                sequenceId: issue?.sequence_id,
                              })}
                              target="_blank"
                              className="relative z-1 hidden shrink-0 text-secondary group-hover/item:block hover:text-primary"
                              rel="noopener noreferrer"
                              aria-label={t("common.actions.open_in_new_tab")}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RocketOutline className="h-4 w-4" aria-hidden="true" />
                            </a>
                          }
                        />
                      )}
                    </ComboboxList>
                  )}
                </>
              )}
            </div>
          </DialogMain>
        </Combobox>
      </DialogContent>
    </Dialog>
  );
}
