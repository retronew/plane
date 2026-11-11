import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { getFileURL } from "@plane/utils";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { MemberWorkService, memberWorkItemHref } from "@/services/member-work.service";
import type {
  MemberWorkFilters,
  MemberWorkItem,
  MemberWorkRow,
  MemberWorkStatus,
} from "@/services/member-work.service";
import AnalyticsWrapper from "./analytics-wrapper";
import AnalyticsRequestError from "./request-error";
import AnalyticsEmptyState from "./empty-state";
import { AnalyticsEntityCell } from "./entity-cell";
import { DataTable } from "./insight-table/data-table";
import { TableLoader } from "./insight-table/loader";
import type { TInsightTableFeatures } from "./insight-table/table-features";
import { StatisticsNotePanel } from "./statistics-note";

type Translate = (key: string, params?: Record<string, unknown>) => string;
type Selection = { id: string; name: string; status: MemberWorkStatus };
const service = new MemberWorkService();
const metrics = [
  "assigned",
  "unstarted",
  "started",
  "completed",
  "cancelled",
  "overdue",
  "late_completed",
  "justified",
  "unjustified",
  "unreviewed",
] as const;
const drillStatuses: Partial<Record<(typeof metrics)[number], MemberWorkStatus>> = {
  assigned: "all",
  overdue: "overdue",
  late_completed: "late_completed",
  justified: "justified",
  unjustified: "unjustified",
  unreviewed: "unreviewed",
};
const label = (t: Translate, field: string) => t(`web.member_work_${field}`);

function MemberProjects({ slug, row, t }: { slug: string; row: MemberWorkRow; t: Translate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-24">
      <Button
        stretch="auto"
        variant="ghost"
        size="sm"
        label={String(row.project_count)}
        aria-label={t("web.member_work_projects_for", { name: row.name, count: row.project_count })}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="flex flex-col gap-2 py-2">
          {row.projects.map((project) => (
            <AnalyticsEntityCell
              key={project.id}
              name={project.name}
              href={`/${slug}/projects/${project.id}/issues/`}
            />
          ))}
          {!row.projects.length && <span className="text-12 text-tertiary">{label(t, "no_projects")}</span>}
        </div>
      )}
    </div>
  );
}
function overviewColumns(
  slug: string,
  t: Translate,
  onSelect: (selection: Selection) => void
): ColumnDef<TInsightTableFeatures, MemberWorkRow>[] {
  return [
    {
      accessorKey: "name",
      header: label(t, "member"),
      cell: ({ row }) => (
        <AnalyticsEntityCell
          name={row.original.name}
          href={`/${slug}/profile/${row.original.id}/`}
          icon={
            <Avatar
              size="xs"
              alt={row.original.name}
              fallback={row.original.name.slice(0, 1)}
              src={getFileURL(row.original.avatar_url ?? "")}
            />
          }
        />
      ),
    },
    {
      accessorKey: "project_count",
      header: label(t, "projects"),
      cell: ({ row }) => <MemberProjects slug={slug} row={row.original} t={t} />,
    },
    ...metrics.map((metric): ColumnDef<TInsightTableFeatures, MemberWorkRow> => ({
      accessorKey: metric,
      header: label(t, metric),
      cell: ({ row }) => {
        const status = drillStatuses[metric];
        return (
          <div className="text-right tabular-nums">
            {status ? (
              <Button
                stretch="auto"
                variant="ghost"
                size="sm"
                label={String(row.original[metric])}
                aria-label={t("web.member_work_drill", {
                  name: row.original.name,
                  metric: label(t, metric),
                  count: row.original[metric],
                })}
                onClick={() => onSelect({ id: row.original.id, name: row.original.name, status })}
              />
            ) : (
              row.original[metric]
            )}
          </div>
        );
      },
    })),
  ];
}
function detailColumns(slug: string, t: Translate): ColumnDef<TInsightTableFeatures, MemberWorkItem>[] {
  return [
    {
      accessorKey: "name",
      header: label(t, "task"),
      cell: ({ row }) => (
        <AnalyticsEntityCell
          name={`${row.original.project_identifier}-${row.original.sequence_id} ${row.original.name}`}
          href={memberWorkItemHref(slug, row.original)}
        />
      ),
    },
    {
      accessorKey: "project_name",
      header: label(t, "projects"),
      cell: ({ row }) => (
        <AnalyticsEntityCell
          name={row.original.project_name}
          href={`/${slug}/projects/${row.original.project_id}/issues/`}
        />
      ),
    },
    { accessorKey: "state_name", header: label(t, "state") },
    {
      accessorKey: "target_date",
      header: label(t, "deadline"),
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.target_date ?? "—"}</span>,
    },
    {
      accessorKey: "completed_at",
      header: label(t, "completed_at"),
      cell: ({ row }) =>
        row.original.completed_at ? format(new Date(row.original.completed_at), "yyyy-MM-dd HH:mm") : "—",
    },
    {
      accessorKey: "reason_status",
      header: label(t, "reason"),
      cell: ({ row }) => (
        <AnalyticsEntityCell
          name={label(t, row.original.reason_status)}
          href={row.original.reason_comment_id ? memberWorkItemHref(slug, row.original, true) : undefined}
        />
      ),
    },
  ];
}
function MemberWorkDetails({
  slug,
  filters,
  selection,
  onBack,
}: {
  slug: string;
  filters: MemberWorkFilters;
  selection: Selection;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useSWR(
    ["member-work", "detail", slug, filters, selection.id, selection.status, page],
    () => service.getMember(slug, selection.id, filters, selection.status, page),
    { keepPreviousData: false, errorRetryCount: 2 }
  );
  const columns = detailColumns(slug, t);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-16 font-medium">
          {t("web.member_work_detail_title", {
            name: selection.name,
            status: label(t, selection.status === "all" ? "assigned" : selection.status),
          })}
        </h2>
        <Button stretch="auto" variant="secondary" size="md" label={label(t, "back")} onClick={onBack} />
      </div>
      {error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : isLoading || !data ? (
        <TableLoader columns={columns} rows={4} />
      ) : (
        <>
          <p className="text-12 text-tertiary">{label(t, "page_search")}</p>
          {data.results.length ? (
            <div className="overflow-x-auto">
              <DataTable
                key={page}
                columns={columns}
                data={data.results}
                searchPlaceholder={t("web.member_work_total", { count: data.count })}
              />
            </div>
          ) : (
            <AnalyticsEmptyState title={label(t, "empty_tasks")} />
          )}
          <div className="flex items-center justify-end gap-3">
            <span className="text-12 text-tertiary">{t("web.member_work_page", { page, count: data.count })}</span>
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              label={label(t, "previous")}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            />
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              label={label(t, "next")}
              disabled={data.next_page === null}
              onClick={() => {
                if (data.next_page !== null) setPage(data.next_page);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
function MemberWorkScope({ slug, filters }: { slug: string; filters: MemberWorkFilters }) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>();
  const { data, error, isLoading, mutate } = useSWR(
    ["member-work", "overview", slug, filters],
    () => service.getOverview(slug, filters),
    { keepPreviousData: false, errorRetryCount: 2 }
  );
  const columns = overviewColumns(slug, t, setSelection);
  if (selection)
    return (
      <MemberWorkDetails
        key={`${selection.id}:${selection.status}`}
        slug={slug}
        filters={filters}
        selection={selection}
        onBack={() => setSelection(undefined)}
      />
    );
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;
  if (isLoading || !data) return <TableLoader columns={columns} rows={4} />;
  if (!data.rows.length)
    return <AnalyticsEmptyState title={label(t, "empty_members")} description={label(t, "empty_hint")} />;
  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        data={data.rows}
        title={label(t, "members")}
        searchPlaceholder={t("web.member_work_total", { count: data.rows.length })}
      />
    </div>
  );
}
export const MemberWorkOverview = observer(function MemberWorkOverview() {
  const { workspaceSlug } = useParams();
  const { selectedProjects } = useAnalytics();
  const { t } = useTranslation();
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const filters: MemberWorkFilters = {
    // oxlint-disable-next-line unicorn/no-array-sort -- ES2022 lib; sort a fresh copy.
    projectIds: [...selectedProjects].sort(),
    ...(range.from && range.to
      ? { startDate: format(range.from, "yyyy-MM-dd"), endDate: format(range.to, "yyyy-MM-dd") }
      : {}),
  };
  const scope = JSON.stringify([workspaceSlug, filters]);
  return (
    <AnalyticsWrapper i18nTitle="web.member_work_title">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-13 font-medium">{label(t, "deadline_range")}</span>
        <DateRangeSelect
          value={range}
          variant="select-md"
          placeholder={label(t, "all_deadlines")}
          formatToken="yyyy/MM/dd"
          mergeDates
          onChange={({ from, to }) => {
            if ((from && to) || (!from && !to)) setRange({ from, to });
          }}
        />
        {range.from && (
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={label(t, "clear_range")}
            onClick={() => setRange({ from: null, to: null })}
          />
        )}
      </div>
      <StatisticsNotePanel>
        <p className="text-12 leading-relaxed text-tertiary">{label(t, "scope_note")}</p>
        <p className="text-12 leading-relaxed text-tertiary">{label(t, "reason_note")}</p>
      </StatisticsNotePanel>
      <div className="mt-5">
        <MemberWorkScope key={scope} slug={String(workspaceSlug)} filters={filters} />
      </div>
    </AnalyticsWrapper>
  );
});
