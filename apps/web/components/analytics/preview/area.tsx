import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { CreatedResolvedChart } from "../work-items/created-resolved-chart";
import { useTranslation } from "@plane/i18n";
import type { IChartResponse } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import { AsyncContent } from "@/components/common/async-content";
import { ChartLoader } from "../loaders";
import AnalyticsRequestError from "../request-error";

const service = new AnalyticsService();
// Preview-only fixtures: never persisted or included in analytics exports.
const demoRows = [
  ["2026-01-01", 18, 10],
  ["2026-02-01", 32, 22],
  ["2026-03-01", 25, 28],
  ["2026-04-01", 48, 31],
  ["2026-05-01", 39, 42],
  ["2026-06-01", 62, 46],
  ["2026-07-01", 51, 55],
  ["2026-08-01", 73, 59],
].map(([key, created_issues, completed_issues]) => ({ key, created_issues, completed_issues }));
export const PreviewArea = observer(function PreviewArea() {
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { selectedDuration, selectedProjects } = useAnalytics();
  const { t } = useTranslation();
  const [demo, setDemo] = useState(true);
  const { data, isLoading, error, mutate } = useSWR(
    demo ? null : ["preview-area", slug, selectedDuration, selectedProjects.join(",")],
    () =>
      service.getAdvanceAnalyticsCharts<IChartResponse>(slug, "work-items", {
        ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
        ...(selectedProjects.length ? { project_ids: selectedProjects.join(",") } : {}),
      }),
    { errorRetryCount: 2 }
  );
  const rows = demo ? demoRows : (data?.data ?? []);
  return (
    <section className="min-w-0 space-y-4" aria-label={t("workspace_analytics.created_vs_resolved")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-16 font-medium">{t("workspace_analytics.created_vs_resolved")}</h2>
        <div className="flex items-center gap-3">
          <span className="text-12 text-tertiary">{t("workspace_analytics.dashboard.monthly")}</span>
          <button
            type="button"
            className="rounded-md border border-subtle px-2.5 py-1 text-12 text-secondary hover:bg-layer-transparent-hover"
            onClick={() => setDemo(!demo)}
          >
            {t(demo ? "workspace_analytics.preview.show_real" : "workspace_analytics.preview.show_demo")}
          </button>
        </div>
      </div>
      {demo && <p className="text-12 text-tertiary">{t("workspace_analytics.preview.demo_note")}</p>}
      {!demo && error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : (
        <AsyncContent loading={!demo && isLoading} skeleton={<ChartLoader height={260} />} minHeight={260}>
          {rows.length ? (
            <>
              <CreatedResolvedChart rows={rows} />
            </>
          ) : (
            <div className="grid h-[260px] place-items-center text-13 text-tertiary">
              {t("common.no_data_available")}
            </div>
          )}
        </AsyncContent>
      )}
    </section>
  );
});
