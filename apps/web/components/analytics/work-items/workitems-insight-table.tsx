import { AnalyticsEntityCell } from "../entity-cell";
import { StatisticsNote, StatisticsNotePanel } from "../statistics-note";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import AnalyticsRequestError from "../request-error";

import { useMemo } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { UserOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { useTranslation } from "@plane/i18n";
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
// plane package imports
import type { AnalyticsTableDataMap, WorkItemInsightColumns } from "@plane/types";
// plane web components

import { getFileURL } from "@plane/utils";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import { exportAnalytics } from "../export";
import { InsightTable } from "../insight-table";
import type { TInsightTableFeatures } from "../insight-table/table-features";

const analyticsService = new AnalyticsService();

const WorkItemsInsightTable = observer(function WorkItemsInsightTable() {
  // router
  const params = useParams();
  const workspaceSlug = params.workspaceSlug.toString();
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const {
    error,
    mutate,
    data: workItemsData,
    isLoading,
  } = useSWR(
    `insights-table-work-items-${workspaceSlug}-${selectedDuration}-${selectedProjects}-${selectedCycle}-${selectedModule}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsStats<WorkItemInsightColumns[]>(
        workspaceSlug,
        "work-items",
        {
          ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
          ...(selectedProjects?.length > 0 ? { project_ids: selectedProjects.join(",") } : {}),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );
  // derived values
  const columnsLabels: Record<keyof Omit<WorkItemInsightColumns, "project_id" | "avatar_url" | "assignee_id">, string> =
    useMemo(
      () => ({
        backlog_work_items: t("workspace_projects.state.backlog"),
        started_work_items: t("workspace_projects.state.started"),
        un_started_work_items: t("workspace_projects.state.unstarted"),
        completed_work_items: t("workspace_projects.state.completed"),
        cancelled_work_items: t("workspace_projects.state.cancelled"),
        project__name: t("common.project"),
        display_name: t("common.assignee"),
      }),
      [t]
    );
  const columns: ColumnDef<TInsightTableFeatures, AnalyticsTableDataMap["work-items"]>[] = useMemo(
    () => [
      !isPeekView
        ? {
            accessorKey: "project__name",
            header: () => <div className="text-left">{columnsLabels["project__name"]}</div>,
            cell: ({ row }) => {
              const project = getProjectById(row.original.project_id);
              const logo = project?.logo_props;
              return (
                <AnalyticsEntityCell
                  name={project?.name || row.original.project__name || t("unassigned")}
                  href={
                    row.original.project_id
                      ? `/${workspaceSlug}/projects/${row.original.project_id}/issues/`
                      : undefined
                  }
                  icon={<ProjectLogo logo={logo} size={16} />}
                />
              );
            },
            meta: {
              export: {
                key: columnsLabels["project__name"],
                value: (row) => row.original.project__name?.toString() ?? "",
              },
            },
          }
        : {
            accessorKey: "display_name",
            header: () => <div className="text-left">{columnsLabels["display_name"]}</div>,
            cell: ({ row }: { row: Row<TInsightTableFeatures, WorkItemInsightColumns> }) => (
              <AnalyticsEntityCell
                name={row.original.display_name || t("unassigned")}
                href={row.original.assignee_id ? `/${workspaceSlug}/profile/${row.original.assignee_id}/` : undefined}
                icon={
                  row.original.display_name ? (
                    <Avatar
                      size="xs"
                      alt={row.original.display_name}
                      fallback={row.original.display_name[0]?.toUpperCase()}
                      src={getFileURL(row.original.avatar_url || "")}
                    />
                  ) : (
                    <UserOutline className="size-4 text-tertiary" />
                  )
                }
              />
            ),
            meta: {
              export: {
                key: columnsLabels["display_name"],
                value: (row) => row.original.display_name?.toString() ?? "",
              },
            },
          },
      {
        accessorKey: "backlog_work_items",
        header: () => <div className="text-right">{columnsLabels["backlog_work_items"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.backlog_work_items}</div>,
        meta: {
          export: {
            key: columnsLabels["backlog_work_items"],
            value: (row) => row.original.backlog_work_items,
          },
        },
      },
      {
        accessorKey: "started_work_items",
        header: () => <div className="text-right">{columnsLabels["started_work_items"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.started_work_items}</div>,
        meta: {
          export: {
            key: columnsLabels["started_work_items"],
            value: (row) => row.original.started_work_items,
          },
        },
      },
      {
        accessorKey: "un_started_work_items",
        header: () => <div className="text-right">{columnsLabels["un_started_work_items"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.un_started_work_items}</div>,
        meta: {
          export: {
            key: columnsLabels["un_started_work_items"],
            value: (row) => row.original.un_started_work_items,
          },
        },
      },
      {
        accessorKey: "completed_work_items",
        header: () => <div className="text-right">{columnsLabels["completed_work_items"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.completed_work_items}</div>,
        meta: {
          export: {
            key: columnsLabels["completed_work_items"],
            value: (row) => row.original.completed_work_items,
          },
        },
      },
      {
        accessorKey: "cancelled_work_items",
        header: () => <div className="text-right">{columnsLabels["cancelled_work_items"]}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.cancelled_work_items}</div>,
        meta: {
          export: {
            key: columnsLabels["cancelled_work_items"],
            value: (row) => row.original.cancelled_work_items,
          },
        },
      },
    ],
    [columnsLabels, getProjectById, isPeekView, t, workspaceSlug]
  );
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;

  return (
    <div id={isPeekView ? undefined : "work-item-breakdown"} className="scroll-mt-4">
      <InsightTable<"work-items">
        title={t("workspace_analytics.work_item_breakdown")}
        analyticsType="work-items"
        data={workItemsData}
        isLoading={isLoading}
        columns={columns}
        columnsLabels={columnsLabels}
        headerText={isPeekView ? t("common.assignee") : t("common.projects")}
        onExport={(rows, format) => workItemsData && exportAnalytics(rows, columns, workspaceSlug, format)}
      />
      <StatisticsNotePanel>
        <StatisticsNote kind="cohort" />
        {isPeekView && <StatisticsNote kind="duplicates" />}
      </StatisticsNotePanel>
    </div>
  );
});

export default WorkItemsInsightTable;
