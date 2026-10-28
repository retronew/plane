/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { EIssueLayoutTypes } from "@plane/types";
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

function IssueLayoutSkeleton({ layout, grouped, propertyCount, showWeekends, calendarLayout }: IssueLayoutLoaderProps) {
  switch (layout) {
    case EIssueLayoutTypes.LIST:
      return <ListLayoutLoader grouped={grouped} propertyCount={propertyCount} />;
    case EIssueLayoutTypes.KANBAN:
      return <KanbanLayoutLoader />;
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

export const IssueLayoutHOC = observer(function IssueLayoutHOC(props: Props) {
  const { layout } = props;

  const storeType = useIssueStoreType();
  const { issues, issuesFilter } = useIssues(storeType);

  const issueCount = issues.getGroupIssueCount(undefined, undefined, false);

  const loading = issues?.getIssueLoader() === "init-loader" || issueCount === undefined;
  useLayoutTransitionReady(!loading);

  if (loading) {
    const filters = issuesFilter?.issueFilters;
    const propertyCount = filters?.displayProperties
      ? Object.entries(filters.displayProperties).filter(([key, enabled]) => key !== "key" && enabled).length
      : undefined;
    return (
      <IssueLayoutLoader
        layout={layout}
        grouped={filters?.displayFilters?.group_by != null}
        propertyCount={propertyCount}
        showWeekends={filters?.displayFilters?.calendar?.show_weekends}
        calendarLayout={filters?.displayFilters?.calendar?.layout}
      />
    );
  }

  if (issues.getGroupIssueCount(undefined, undefined, false) === 0 && layout !== EIssueLayoutTypes.CALENDAR) {
    return <IssueLayoutEmptyState storeType={storeType} />;
  }

  return <LayoutErrorBoundary key={layout}>{props.children}</LayoutErrorBoundary>;
});
