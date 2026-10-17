/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { observer } from "mobx-react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircularProgress } from "@makeplane/propel/components/circular-progress";
import { TickOutline } from "@makeplane/propel/icons";
// plane imports
import type { TCycleGroups } from "@plane/types";
import { CycleGroupIcon } from "@plane/blocks/icons";
// components
import { generateQueryParams, calculateCycleProgress, cn } from "@plane/utils";
import { ListItem } from "@/components/core/list";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { CycleQuickActions } from "../quick-actions";
import { CycleListItemAction } from "./cycle-list-item-action";
import { translate } from "@plane/i18n";

type TCyclesListItem = {
  cycleId: string;
  handleEditCycle?: () => void;
  handleDeleteCycle?: () => void;
  handleAddToFavorites?: () => void;
  handleRemoveFromFavorites?: () => void;
  workspaceSlug: string;
  projectId: string;
  className?: string;
  leadingElement?: ReactNode;
  disclosure?: { expanded: boolean; onToggle: () => void; panelId: string };
};

function CycleListProgress({ progress, expanded }: { progress: number; expanded?: boolean }) {
  return expanded === false ? (
    <CycleGroupIcon cycleGroup="current" className="size-4 shrink-0" />
  ) : expanded ? (
    <div className="relative size-12 shrink-0" aria-label={`${translate("web.cycle_progress")} ${progress}%`}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="22.5" stroke="var(--border-color-strong)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r="22.5"
          className="stroke-success-secondary"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 22.5}
          strokeDashoffset={2 * Math.PI * 22.5 * (1 - progress / 100)}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption-md-medium text-primary">
        {progress}%
      </span>
    </div>
  ) : (
    <div className="relative size-[30px] shrink-0">
      <div className="absolute inset-0 flex scale-150 items-center justify-center">
        <CircularProgress
          value={progress}
          size="md"
          variant={progress === 100 ? "success" : "brand"}
          aria-label={translate("web.cycle_progress")}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {progress === 100 ? (
          <TickOutline className="h-3 w-3" />
        ) : (
          <span className="text-9 text-primary">{`${progress}%`}</span>
        )}
      </div>
    </div>
  );
}

export const CyclesListItem = observer(function CyclesListItem(props: TCyclesListItem) {
  const { cycleId, workspaceSlug, projectId, className = "", leadingElement, disclosure } = props;
  // refs
  const parentRef = useRef(null);
  // router
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // hooks
  const { isMobile } = usePlatformOS();
  // store hooks
  const { getCycleById } = useCycle();

  // derived values
  const cycleDetails = getCycleById(cycleId);

  if (!cycleDetails) return null;

  // computed
  // TODO: change this logic once backend fix the response
  const cycleStatus = cycleDetails.status ? (cycleDetails.status.toLocaleLowerCase() as TCycleGroups) : "draft";
  const isActive = cycleStatus === "current";

  // handlers
  const openCycleOverview = (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const query = generateQueryParams(searchParams, ["peekCycle"]);
    if (searchParams.has("peekCycle") && searchParams.get("peekCycle") === cycleId) {
      router.push(`${pathname}?${query}`);
    } else {
      router.push(`${pathname}?${query && `${query}&`}peekCycle=${cycleId}`);
    }
  };

  // handlers
  const handleArchivedCycleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    openCycleOverview(e);
  };

  const handleItemClick = cycleDetails.archived_at ? handleArchivedCycleClick : undefined;

  const progress = calculateCycleProgress(cycleDetails);

  return (
    <ListItem
      title={cycleDetails?.name ?? ""}
      itemLink={`/${workspaceSlug}/projects/${projectId}/cycles/${cycleDetails.id}`}
      onItemClick={handleItemClick}
      leadingElement={leadingElement}
      titleClassName={disclosure?.expanded ? "text-h4-bold" : disclosure ? "text-body-xs-medium" : undefined}
      className={cn(
        isActive && !disclosure && "min-h-14 rounded-lg border border-subtle bg-layer-1 !py-3",
        disclosure && "bg-surface-1 hover:bg-surface-1",
        disclosure?.expanded && "min-h-20 !py-4",
        className
      )}
      itemClassName="min-w-0"
      actionItemContainerClassName={isActive ? "gap-3" : undefined}
      prependTitleElement={
        isActive ? (
          <CycleListProgress progress={progress} expanded={disclosure?.expanded} />
        ) : (
          <CycleGroupIcon cycleGroup={cycleStatus} className="size-4 shrink-0" />
        )
      }
      actionableItems={
        <CycleListItemAction
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          cycleId={cycleId}
          cycleDetails={cycleDetails}
          parentRef={parentRef}
          isActive={isActive}
        />
      }
      quickActionElement={
        <div className="block md:hidden">
          <CycleQuickActions
            parentRef={parentRef}
            cycleId={cycleId}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            onOpenDetails={() => {
              const query = generateQueryParams(searchParams, ["peekCycle"]);
              router.push(`${pathname}?${query ? `${query}&` : ""}peekCycle=${cycleId}`);
            }}
          />
        </div>
      }
      isMobile={isMobile}
      parentRef={parentRef}
      isSidebarOpen={searchParams.has("peekCycle")}
    />
  );
});
