import { orderBy } from "lodash-es";
import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Link } from "react-router";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TAnalyticsDetailRow } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import AnalyticsWrapper from "../analytics-wrapper";
import { DataTable } from "../insight-table/data-table";
import type { TInsightTableFeatures } from "../insight-table/table-features";
import { AnalyticsExportMenu } from "../export-menu";
import { exportAnalytics } from "../export";
import { PreviewArea } from "./area";
import { PreviewChart } from "./chart";
import { PreviewChoice, PreviewContent, PreviewNote } from "./shared";

const service = new AnalyticsService();
export const ProjectProgressPreview = observer(function ProjectProgressPreview() {
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { selectedProjects, selectedDuration } = useAnalytics();
  const { t } = useTranslation();
  const [metric, setMetric] = useState<"work_items" | "completion">("work_items");
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(0);
  const scope = `${slug}:${selectedProjects.join(",")}:${selectedDuration}`;
  const [selectionScope, setSelectionScope] = useState(scope);
  const selectedKey = scope === selectionScope ? selected : undefined;
  const { data, isLoading, error, mutate } = useSWR(
    ["analytics-details", slug, "projects", selectedProjects.join(","), selectedDuration],
    () => service.getAnalyticsDetails(slug, "projects", selectedProjects, selectedDuration),
    { errorRetryCount: 2 }
  );
  const rows = data?.rows ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.work_items ?? 0), 0);
  const effective = total - rows.reduce((sum, row) => sum + Number(row.cancelled ?? 0), 0);
  const completed = rows.reduce((sum, row) => sum + Number(row.completed ?? 0), 0);
  const field = (key: string) => t(`workspace_analytics.details.fields.${key}`);
  const ordered = orderBy(rows, [(row) => Number(row[metric]), "name"], ["desc", "asc"]);
  const pages = Math.max(1, Math.ceil(ordered.length / 12));
  const activePage = Math.min(page, pages - 1);
  const columns = useMemo<ColumnDef<TInsightTableFeatures, TAnalyticsDetailRow>[]>(
    () =>
      ["name", "work_items", "completed", "cycles", "modules", "completion"].map((key) => ({
        accessorKey: key,
        header: t(`workspace_analytics.details.fields.${key}`),
        cell: ({ row }) =>
          key === "name" ? (
            <Link
              className="block max-w-80 truncate hover:text-accent-primary"
              title={String(row.original.name)}
              to={`/${slug}/projects/${row.original.id}/issues/`}
            >
              {row.original.name}
            </Link>
          ) : key === "completion" ? (
            <div className="flex items-center justify-end gap-2">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                <span
                  className="block h-full rounded-full bg-accent-primary"
                  style={{ width: `${row.original.completion}%` }}
                />
              </span>
              <span className="w-10 text-right tabular-nums">{row.original.completion}%</span>
            </div>
          ) : (
            <span className="block text-right tabular-nums">{row.original[key] ?? 0}</span>
          ),
        meta: {
          export: { key: t(`workspace_analytics.details.fields.${key}`), value: (row) => row.original[key] ?? "" },
        },
      })),
    [slug, t]
  );
  const visible = selectedKey ? rows.filter((row) => String(row.id) === selectedKey) : rows;
  return (
    <AnalyticsWrapper i18nTitle="workspace_analytics.preview.projects" className="pt-6">
      <PreviewNote />
      <PreviewContent loading={isLoading} error={error} retry={() => void mutate()}>
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              [field("total_projects"), rows.length],
              [field("work_items"), total],
              [field("completed"), completed],
              [field("completion"), `${effective ? Math.round((completed * 100) / effective) : 0}%`],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1.5">
                <div className="text-12 text-tertiary">{label}</div>
                <div className="text-24 font-medium tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <PreviewArea />
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-16 font-medium">{t("workspace_analytics.preview.project_comparison")}</h2>
              <div className="flex items-center gap-2">
                <PreviewChoice
                  label={t("workspace_analytics.preview.metric")}
                  value={metric}
                  options={[
                    { id: "work_items", label: field("work_items") },
                    { id: "completion", label: field("completion") },
                  ]}
                  onChange={(value) => {
                    setMetric(value);
                    setPage(0);
                  }}
                />
                {pages > 1 && (
                  <>
                    <Button
                      stretch="auto"
                      variant="ghost"
                      size="md"
                      disabled={!activePage}
                      onClick={() => setPage(activePage - 1)}
                      label={t("workspace_analytics.details.previous")}
                    />
                    <span className="text-12">
                      {activePage + 1}/{pages}
                    </span>
                    <Button
                      stretch="auto"
                      variant="ghost"
                      size="md"
                      disabled={activePage + 1 >= pages}
                      onClick={() => setPage(activePage + 1)}
                      label={t("workspace_analytics.details.next")}
                    />
                  </>
                )}
              </div>
            </div>
            <PreviewChart
              data={ordered
                .slice(activePage * 12, (activePage + 1) * 12)
                .map((row) => ({ key: String(row.id), name: String(row.name), value: Number(row[metric] ?? 0) }))}
              label={field(metric)}
              unit={metric === "completion" ? "%" : ""}
              selected={selectedKey}
              onSelect={(key) => {
                setSelectionScope(scope);
                setSelected(selectedKey === key ? undefined : key);
              }}
            />
          </section>
          {selectedKey && (
            <Button
              stretch="auto"
              variant="ghost"
              size="md"
              onClick={() => setSelected(undefined)}
              label={t("workspace_analytics.preview.show_all")}
            />
          )}
          <DataTable
            title={t("workspace_analytics.dashboard.project_progress")}
            data={visible}
            columns={columns}
            searchPlaceholder={t("workspace_analytics.details.records", { count: visible.length })}
            actions={(table) => (
              <AnalyticsExportMenu
                disabled={!table.getFilteredRowModel().rows.length}
                onExport={(format) => exportAnalytics(table.getFilteredRowModel().rows, columns, slug, format)}
              />
            )}
          />
        </div>
      </PreviewContent>
    </AnalyticsWrapper>
  );
});
