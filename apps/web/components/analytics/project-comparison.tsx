import { orderBy } from "lodash-es";
import { lazy, Suspense, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TAnalyticsDetailRow } from "@plane/types";
import { CHART_SEMANTIC_COLORS } from "@plane/constants";
import { AnalyticsChoice } from "./choice";
import { StatisticsNotePanel } from "./statistics-note";
import { ChartLoader } from "./loaders";

// recharts is a large dependency; both charts load when this section renders.
const ComparisonChart = lazy(() => import("./comparison-chart").then((mod) => ({ default: mod.ComparisonChart })));
const BarChart = lazy(() => import("@plane/blocks/charts/bar-chart").then((mod) => ({ default: mod.BarChart })));

export function projectCompletion(rows: TAnalyticsDetailRow[]) {
  const completed = rows.reduce((sum, row) => sum + Number(row.completed ?? 0), 0);
  const effective = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.work_items ?? 0) - Number(row.cancelled ?? 0)),
    0
  );
  return effective ? Math.round((completed * 100) / effective) : 0;
}

export function ProjectComparison({
  rows,
  statuses,
  selected,
  onSelect,
}: {
  rows: TAnalyticsDetailRow[];
  statuses: { key: string; name: string; count: number }[];
  selected?: string;
  onSelect: (key?: string) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"projects" | "statuses">("projects");
  const [metric, setMetric] = useState<"work_items" | "completion">("work_items");
  const [page, setPage] = useState(0);
  const ordered = orderBy(rows, [(row) => Number(row[metric] ?? 0), "name", "id"], ["desc", "asc", "asc"]);
  const pages = Math.max(1, Math.ceil(ordered.length / 12));
  const activePage = Math.min(page, pages - 1);
  return (
    <section data-project-comparison="">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-16 font-medium">{t("workspace_analytics.project_analysis.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsChoice
            label={t("workspace_analytics.project_analysis.mode")}
            value={mode}
            options={[
              { id: "projects", label: t("workspace_analytics.project_analysis.comparison") },
              { id: "statuses", label: t("workspace_analytics.details.charts.projects") },
            ]}
            onChange={(value) => {
              setMode(value);
              onSelect(undefined);
            }}
          />
          {mode === "projects" && (
            <AnalyticsChoice
              label={t("workspace_analytics.project_analysis.metric")}
              value={metric}
              options={[
                { id: "work_items", label: t("workspace_analytics.details.fields.work_items") },
                { id: "completion", label: t("workspace_analytics.details.fields.completion") },
              ]}
              onChange={(value) => {
                setMetric(value);
                setPage(0);
              }}
            />
          )}
          {mode === "projects" && pages > 1 && (
            <>
              <Button
                variant="ghost"
                size="md"
                stretch="auto"
                label={t("workspace_analytics.details.previous")}
                disabled={!activePage}
                onClick={() => setPage(activePage - 1)}
              />
              <span className="text-12 text-tertiary tabular-nums">
                {activePage + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                size="md"
                stretch="auto"
                label={t("workspace_analytics.details.next")}
                disabled={activePage + 1 === pages}
                onClick={() => setPage(activePage + 1)}
              />
            </>
          )}
        </div>
      </div>
      <Suspense fallback={<ChartLoader />}>
        {mode === "projects" ? (
          <ComparisonChart
            horizontal
            label={t(`workspace_analytics.details.fields.${metric}`)}
            unit={metric === "completion" ? "%" : ""}
            data={ordered
              .slice(activePage * 12, (activePage + 1) * 12)
              .map((row) => ({ key: String(row.id), name: String(row.name), value: Number(row[metric] ?? 0) }))}
            selected={selected}
            onSelect={(key) => onSelect(selected === key ? undefined : key)}
          />
        ) : statuses.length ? (
          <BarChart
            className="h-64 w-full"
            data={statuses}
            barSize={24}
            bars={[
              {
                key: "count",
                label: t("workspace_analytics.details.fields.count"),
                fill: CHART_SEMANTIC_COLORS.primary,
                textClassName: "fill-primary",
                stackId: "project-status",
              },
            ]}
            xAxis={{ key: "name", label: "" }}
            yAxis={{ key: "count", label: t("workspace_analytics.details.fields.count") }}
          />
        ) : (
          <p className="py-12 text-center text-13 text-tertiary">{t("common.no_data_available")}</p>
        )}
      </Suspense>
      <StatisticsNotePanel>
        <p className="text-12 leading-relaxed text-tertiary">
          {t(
            mode === "projects"
              ? "workspace_analytics.project_analysis.hint"
              : "workspace_analytics.project_summary_hints.distribution"
          )}
        </p>
      </StatisticsNotePanel>
      {selected && (
        <div className="mt-4 flex items-center gap-3 text-12 text-secondary">
          <span className="truncate">
            {t("workspace_analytics.project_analysis.selected", {
              name: String(rows.find((row) => String(row.id) === selected)?.name ?? ""),
            })}
          </span>
          <Button
            variant="ghost"
            size="md"
            stretch="auto"
            label={t("workspace_analytics.project_analysis.show_all")}
            onClick={() => onSelect(undefined)}
          />
        </div>
      )}
    </section>
  );
}
