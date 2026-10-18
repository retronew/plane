/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useMemo, useCallback, useEffect, useEffectEvent } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// hooks
import { CloseOutline, SearchOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
// power-k
import type { TPowerKCommandConfig, TPowerKContext } from "@/components/power-k/core/types";
import { ProjectsAppPowerKCommandsList } from "@/components/power-k/ui/modal/commands-list";
import { PowerKModalFooter } from "@/components/power-k/ui/modal/footer";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { usePowerK } from "@/hooks/store/use-power-k";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useExpandableSearch } from "@/hooks/use-expandable-search";
import { translate } from "@plane/i18n";

export const TopNavPowerK = observer(() => {
  // router
  const router = useAppRouter();
  const params = useParams();
  const { projectId: routerProjectId, workItem: workItemIdentifier } = params;

  // states
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCommand, setActiveCommand] = useState<TPowerKCommandConfig | null>(null);
  const [shouldShowContextBasedActions, setShouldShowContextBasedActions] = useState(true);
  const [isWorkspaceLevel, setIsWorkspaceLevel] = useState(false);

  // store hooks
  const { activeContext, setActivePage, activePage, setTopNavInputRef } = usePowerK();
  const { data: currentUser } = useUser();

  const handleOnClose = useCallback(() => {
    setSearchTerm("");
    setActivePage(null);
    setActiveCommand(null);
  }, [setSearchTerm, setActivePage, setActiveCommand]);

  // expandable search hook
  const {
    isOpen,
    containerRef,
    inputRef,
    handleClose: closePanel,
    handleMouseDown,
    handleFocus,
    openPanel,
  } = useExpandableSearch();
  const [panelMounted, setPanelMounted] = useState(false);
  // Reading the close handler through an effect event keeps a new callback identity from restarting
  // the exit timer, which would leave the panel mounted.
  const onClose = useEffectEvent(handleOnClose);
  useEffect(() => {
    if (isOpen) {
      setPanelMounted(true);
      return;
    }
    const timer = setTimeout(() => {
      setPanelMounted(false);
      onClose();
    }, 220);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // derived values
  const {
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();

  const workItemId = workItemIdentifier ? getIssueIdByIdentifier(workItemIdentifier.toString()) : undefined;
  const workItemDetails = workItemId ? getIssueById(workItemId) : undefined;
  const projectId: string | string[] | undefined | null = routerProjectId ?? workItemDetails?.project_id;

  // Build command context
  const context: TPowerKContext = useMemo(
    () => ({
      currentUserId: currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      setShouldShowContextBasedActions,
      params: {
        ...params,
        projectId,
      },
      router,
      closePalette: closePanel,
      setActiveCommand,
      setActivePage,
    }),
    [
      currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      params,
      projectId,
      router,
      setActivePage,
      closePanel,
    ]
  );

  // Register input ref with PowerK store for keyboard shortcut access
  useEffect(() => {
    setTopNavInputRef(inputRef);
    return () => {
      setTopNavInputRef(null);
    };
  }, [inputRef, setTopNavInputRef]);

  const handleClear = () => {
    setSearchTerm("");
    inputRef.current?.focus();
  };

  // Handle command selection
  const handleCommandSelect = useCallback(
    (command: TPowerKCommandConfig) => {
      if (command.type === "action") {
        command.action(context);
        // Always close on command selection
        context.closePalette();
      } else if (command.type === "change-page") {
        context.setActiveCommand(command);
        setActivePage(command.page);
        setSearchTerm("");
      }
    },
    [context, setActivePage]
  );

  // Handle selection page item selection
  const handlePageDataSelection = useCallback(
    (data: unknown) => {
      if (context.activeCommand?.type === "change-page") {
        context.activeCommand.onSelect(data, context);
      }
      // Always close on page data selection
      context.closePalette();
    },
    [context]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+K closes the search dropdown
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        closePanel();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (searchTerm) {
          setSearchTerm("");
        }
        closePanel();
        return;
      }

      if (e.key === "Backspace" && !searchTerm) {
        if (activePage) {
          e.preventDefault();
          setActivePage(null);
          context.setActiveCommand(null);
        } else if (shouldShowContextBasedActions) {
          // Optional: logic to hide context actions if desired, similar to wrapper
          context.setShouldShowContextBasedActions(false);
        }
        return;
      }

      // Arrow down/up keys to navigate command items
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && isOpen) {
        e.preventDefault();
        // Get the Command.List element
        const commandList = containerRef.current?.querySelector("[cmdk-list]") as HTMLElement;
        if (commandList) {
          // Create and dispatch a keyboard event on the list to trigger cmdk navigation
          const syntheticEvent = new KeyboardEvent("keydown", {
            key: e.key,
            bubbles: true,
            cancelable: true,
          });
          commandList.dispatchEvent(syntheticEvent);

          // Also try to focus the first/selected item
          if (e.key === "ArrowDown") {
            const firstItem = commandList.querySelector('[cmdk-item]:not([aria-disabled="true"])') as HTMLElement;
            if (firstItem) {
              firstItem.focus();
            }
          }
        }
        return;
      }

      // Enter key to execute selected command
      if (e.key === "Enter" && isOpen) {
        e.preventDefault();
        // Find the currently selected/focused item
        const selectedItem = containerRef.current?.querySelector('[cmdk-item][aria-selected="true"]') as HTMLElement;
        if (selectedItem) {
          // Trigger click on the selected item
          selectedItem.click();
        }
        return;
      }
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- containerRef is a ref; reading .current at call time is intended
    [searchTerm, activePage, context, shouldShowContextBasedActions, setActivePage, closePanel, isOpen]
  );

  return (
    <div
      ref={containerRef}
      data-open={isOpen || undefined}
      className={cn("top-nav-command-search relative w-[364px]", isOpen && "w-[554px]")}
    >
      <div className="relative z-30 flex w-full items-center">
        <div
          className={cn(
            "flex h-7 w-full items-center rounded-lg border border-subtle-1 bg-layer-2 p-2 transition-colors duration-200",
            {
              "bg-layer-1": isOpen,
            }
          )}
        >
          <label className="flex min-w-0 flex-1 items-center">
            <SearchOutline className="mr-2 size-3.5 shrink-0 text-placeholder" />
            <input
              aria-label={translate("web.search_commands")}
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) openPanel();
              }}
              onMouseDown={handleMouseDown}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder={translate("web.search_commands")}
              className="placeholder-text-placeholder min-w-0 flex-1 bg-transparent text-13 text-primary outline-none"
            />
          </label>
          {searchTerm && (
            <button
              type="button"
              aria-label={translate("power_k.search_menu.clear_search")}
              onClick={handleClear}
              className="ml-2 shrink-0"
            >
              <CloseOutline className="size-3.5 text-placeholder hover:text-primary" />
            </button>
          )}
        </div>
      </div>
      <div
        className={cn(
          "shadow-lg absolute -top-[6px] -right-2.5 -left-2.5 z-20 flex max-h-[80vh] flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1 px-0 pt-10 transition-opacity duration-150 motion-reduce:transition-none",
          {
            "visible opacity-100": isOpen,
            "pointer-events-none opacity-0": !isOpen,
            invisible: !isOpen && !panelMounted,
          }
        )}
        inert={!isOpen}
        aria-hidden={!isOpen}
      >
        {(isOpen || panelMounted) && (
          <Command
            filter={(i18nValue: string, search: string) => {
              if (i18nValue === "no-results") return 1;
              if (i18nValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
            shouldFilter={searchTerm.length > 0}
            data-search-content=""
            data-open={isOpen || undefined}
            className="flex h-full w-full flex-col"
          >
            <Command.Input value={searchTerm} hidden />
            {/* We can skip the header input since we have the main input above,
                     but we might need the context indicator if we want that feature.
                     For now, let's just render the list. */}

            <Command.List className="vertical-scrollbar scrollbar-sm max-h-[60vh] overflow-y-auto px-2 pb-2 outline-none">
              <ProjectsAppPowerKCommandsList
                activePage={activePage}
                context={context}
                handleCommandSelect={handleCommandSelect}
                handlePageDataSelection={handlePageDataSelection}
                isWorkspaceLevel={isWorkspaceLevel}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleSearchMenuClose={() => closePanel()}
              />
            </Command.List>
            <PowerKModalFooter
              isWorkspaceLevel={isWorkspaceLevel}
              projectId={context.params.projectId?.toString()}
              onWorkspaceLevelChange={setIsWorkspaceLevel}
            />
          </Command>
        )}
      </div>
    </div>
  );
});
