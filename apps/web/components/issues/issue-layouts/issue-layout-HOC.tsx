/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EIssueLayoutTypes, type IIssueDisplayProperties } from "@plane/types";
// components
import { useLayoutTransitionReady } from "@/components/common/layout-transition";
import { LayoutErrorBoundary } from "@/components/common/layout-error-boundary";
import { CalendarLayoutLoader } from "@/components/ui/loader/layouts/calendar-layout-loader";
import { GanttLayoutLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
import { KanbanLayoutLoader } from "@/components/ui/loader/layouts/kanban-layout-loader";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { SpreadsheetLayoutLoader } from "@/components/ui/loader/layouts/spreadsheet-layout-loader";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { IssueLayoutEmptyState } from "./empty-states";

type IssueLayoutLoaderProps = {
  layout: EIssueLayoutTypes;
  grouped?: boolean;
  propertyCount?: number;
  displayProperties?: IIssueDisplayProperties;
  showWeekends?: boolean;
  calendarLayout?: "month" | "week";
};

export const IssueLayoutLoader = observer(function IssueLayoutLoader(props: IssueLayoutLoaderProps) {
  const { layout } = props;
  return (
    <div className="size-full overflow-hidden" aria-busy="true" data-issue-loader={layout}>
      <IssueLayoutSkeleton {...props} />
    </div>
  );
});

function IssueLayoutSkeleton({
  layout,
  grouped,
  propertyCount,
  displayProperties,
  showWeekends,
  calendarLayout,
}: IssueLayoutLoaderProps) {
  switch (layout) {
    case EIssueLayoutTypes.LIST:
      return <ListLayoutLoader grouped={grouped} propertyCount={propertyCount} />;
    case EIssueLayoutTypes.KANBAN:
      return <KanbanLayoutLoader displayProperties={displayProperties} />;
    case EIssueLayoutTypes.SPREADSHEET:
      return <SpreadsheetLayoutLoader columnCount={propertyCount} />;
    case EIssueLayoutTypes.CALENDAR:
      return <CalendarLayoutLoader showWeekends={showWeekends} layout={calendarLayout} />;
    case EIssueLayoutTypes.GANTT:
      return <GanttLayoutLoader />;
    default:
      return null;
  }
}

interface Props {
  children: string | React.ReactNode | React.ReactNode[];
  layout: EIssueLayoutTypes;
}

const SKELETON_REVEAL_DELAY_MS = 150;
const SKELETON_EXIT_DURATION_MS = 180;

export const IssueLayoutHOC = observer(function IssueLayoutHOC(props: Props) {
  const { layout } = props;

  const storeType = useIssueStoreType();
  const { issues, issuesFilter } = useIssues(storeType);

  const issueCount = issues.getGroupIssueCount(undefined, undefined, false);
  const appliedLayout = "appliedDisplayFilters" in issues ? issues.appliedDisplayFilters?.layout : undefined;
  const layoutMismatch = appliedLayout !== undefined && appliedLayout !== layout;

  const loading = issues?.getIssueLoader() === "init-loader" || issueCount === undefined || layoutMismatch;
  useLayoutTransitionReady(!loading);

  const filters = issuesFilter?.issueFilters;
  const propertyCount = filters?.displayProperties
    ? Object.entries(filters.displayProperties).filter(([key, enabled]) => key !== "key" && enabled).length
    : undefined;
  const loaderProps: IssueLayoutLoaderProps = {
    layout,
    grouped: filters?.displayFilters?.group_by != null,
    displayProperties: filters?.displayProperties,
    propertyCount,
    showWeekends: filters?.displayFilters?.calendar?.show_weekends,
    calendarLayout: filters?.displayFilters?.calendar?.layout,
  };

  const loadingStartRef = useRef<number | null>(null);
  const lastLoaderPropsRef = useRef<IssueLayoutLoaderProps>(loaderProps);
  const [exitingSkeleton, setExitingSkeleton] = useState<IssueLayoutLoaderProps | null>(null);

  useLayoutEffect(() => {
    if (loading) {
      lastLoaderPropsRef.current = loaderProps;
      if (loadingStartRef.current === null) {
        loadingStartRef.current = performance.now();
      }
      setExitingSkeleton(null);
      return;
    }
    if (loadingStartRef.current !== null) {
      const elapsed = performance.now() - loadingStartRef.current;
      loadingStartRef.current = null;
      if (elapsed >= SKELETON_REVEAL_DELAY_MS) {
        setExitingSkeleton(lastLoaderPropsRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to loading/layout handoff transitions
  }, [loading, layout]);

  useEffect(() => {
    if (!exitingSkeleton) return undefined;
    const timer = window.setTimeout(() => setExitingSkeleton(null), SKELETON_EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exitingSkeleton]);

  if (loading) {
    return <IssueLayoutLoader {...loaderProps} />;
  }

  const content =
    issues.getGroupIssueCount(undefined, undefined, false) === 0 && layout !== EIssueLayoutTypes.CALENDAR ? (
      <IssueLayoutEmptyState storeType={storeType} />
    ) : (
      <LayoutErrorBoundary key={layout}>{props.children}</LayoutErrorBoundary>
    );

  return (
    <div className="relative size-full">
      {content}
      {exitingSkeleton && (
        <div
          data-skeleton-exit=""
          aria-hidden="true"
          className="skeleton-exit pointer-events-none absolute inset-0 z-20 overflow-hidden bg-surface-1"
          onAnimationEnd={() => setExitingSkeleton(null)}
        >
          <IssueLayoutLoader {...exitingSkeleton} />
        </div>
      )}
    </div>
  );
});
