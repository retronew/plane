/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
// plane imports
import { WORKSPACE_DEFAULT_SEARCH_RESULT } from "@plane/constants";
import type { IWorkspaceSearchResults } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";
import useDebounce from "@/hooks/use-debounce";
import { WorkspaceService } from "@/services/workspace.service";
// local imports
import type { TPowerKContext, TPowerKPageType } from "../../core/types";
import { PowerKModalNoSearchResultsCommand } from "./no-results-command";
import { PowerKModalSearchResults } from "./search-results";

// services init
const workspaceService = new WorkspaceService();

type Props = {
  activePage: TPowerKPageType | null;
  context: TPowerKContext;
  isWorkspaceLevel: boolean;
  searchTerm: string;
  updateSearchTerm: (value: string) => void;
  handleSearchMenuClose?: () => void;
};

export function PowerKModalSearchMenu(props: Props) {
  const { activePage, context, isWorkspaceLevel, searchTerm, updateSearchTerm, handleSearchMenuClose } = props;
  // navigation
  const { workspaceSlug, projectId } = useParams();
  // states
  const [resultsCount, setResultsCount] = useState(0);
  const [isSearching, setIsSearching] = useState(() => !activePage && Boolean(workspaceSlug && searchTerm));
  const [results, setResults] = useState<IWorkspaceSearchResults>(WORKSPACE_DEFAULT_SEARCH_RESULT);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  // store hooks
  const { togglePowerKModal } = usePowerK();

  const searchKey = JSON.stringify([debouncedSearchTerm, isWorkspaceLevel, projectId, workspaceSlug, activePage]);
  const [previousSearchKey, setPreviousSearchKey] = useState(searchKey);
  if (previousSearchKey !== searchKey) {
    setPreviousSearchKey(searchKey);
    if (!activePage && workspaceSlug) {
      setIsSearching(Boolean(debouncedSearchTerm));
      if (!debouncedSearchTerm) setResults(WORKSPACE_DEFAULT_SEARCH_RESULT);
    }
  }

  useEffect(() => {
    if (activePage || !workspaceSlug) return;

    if (debouncedSearchTerm) {
      workspaceService
        .searchWorkspace(workspaceSlug.toString(), {
          ...(projectId ? { project_id: projectId.toString() } : {}),
          search: debouncedSearchTerm,
          workspace_search: !projectId ? true : isWorkspaceLevel,
        })
        // oxlint-disable-next-line no-shadow oxlint-disable-next-line promise/always-return
        .then((results) => {
          setResults(results);
          const count = Object.keys(results.results).reduce(
            (accumulator, key) => results.results[key as keyof typeof results.results]?.length + accumulator,
            0
          );
          setResultsCount(count);
        })
        .catch(() => {
          setResults(WORKSPACE_DEFAULT_SEARCH_RESULT);
          setResultsCount(0);
        })
        .finally(() => setIsSearching(false));
    }
  }, [debouncedSearchTerm, isWorkspaceLevel, projectId, workspaceSlug, activePage]);

  if (activePage) return null;

  const handleClosePalette = () => {
    handleSearchMenuClose?.();
    togglePowerKModal(false);
  };

  return (
    <>
      {searchTerm.trim() !== "" && (
        <div className="mt-4 flex items-center justify-between gap-2 px-4">
          <h5
            className={cn("text-11 text-primary", {
              "animate-pulse": isSearching,
            })}
          >
            <Translation
              translationKey={isWorkspaceLevel ? "web.ui.search_workspace" : "web.ui.project_search_results"}
              components={{ query: <span className="font-medium">{searchTerm}</span> }}
            />
          </h5>
        </div>
      )}

      {/* Show empty state only when not loading and no results */}
      {!isSearching && resultsCount === 0 && searchTerm.trim() !== "" && debouncedSearchTerm.trim() !== "" && (
        <PowerKModalNoSearchResultsCommand
          context={context}
          searchTerm={searchTerm}
          updateSearchTerm={updateSearchTerm}
        />
      )}

      {searchTerm.trim() !== "" && <PowerKModalSearchResults closePalette={handleClosePalette} results={results} />}
    </>
  );
}
