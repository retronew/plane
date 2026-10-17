import type { ICycle, TCycleDailySnapshot, TProject } from "@plane/types";
import type { CycleCardData } from "@/components/active-cycles/cycle-card";

const DAY = 86_400_000;

/** Calendar dates must use the project's timezone, independently of the browser. */
function projectDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function projectActiveCycleData(
  cycle: ICycle,
  project: Pick<TProject, "id" | "name" | "identifier" | "logo_props" | "timezone">,
  snapshots: TCycleDailySnapshot[],
  now = new Date()
): CycleCardData | null {
  if (!cycle.start_date || !cycle.end_date || now < new Date(cycle.start_date) || now > new Date(cycle.end_date))
    return null;
  return projectCycleChartData(cycle, project, snapshots, now);
}

/** Detail charts can read ended cycles without manufacturing a final observation. */
export function projectCycleChartData(
  cycle: ICycle,
  project: Pick<TProject, "id" | "name" | "identifier" | "logo_props" | "timezone">,
  snapshots: TCycleDailySnapshot[],
  now = new Date()
): CycleCardData | null {
  if (!cycle.start_date || !cycle.end_date || !project.timezone || cycle.project_id !== project.id) return null;
  const startInstant = new Date(cycle.start_date);
  const endInstant = new Date(cycle.end_date);
  if (!Number.isFinite(startInstant.getTime()) || !Number.isFinite(endInstant.getTime())) return null;
  if (now < startInstant || endInstant < startInstant) return null;
  const ended = now > endInstant;
  const today = projectDate(ended ? endInstant : now, project.timezone);
  const start = projectDate(startInstant, project.timezone);
  const end = projectDate(endInstant, project.timezone);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  const step = Math.max(1, Math.ceil((endTime - startTime) / DAY / 365));
  const dates = new Set([today, end]);
  for (let date = startTime; date <= endTime; date += step * DAY) dates.add(new Date(date).toISOString().slice(0, 10));

  const history = new Map<string, TCycleDailySnapshot>();
  for (const snapshot of snapshots) {
    if (snapshot.progress_date < start || snapshot.progress_date > today || snapshot.progress_date > end) continue;
    const observed = Date.parse(snapshot.observed_at);
    if (!Number.isFinite(observed) || observed > now.getTime()) continue;
    const previous = history.get(snapshot.progress_date);
    if (!previous || observed > Date.parse(previous.observed_at)) history.set(snapshot.progress_date, snapshot);
    if (ended) dates.add(snapshot.progress_date);
  }
  const progressChart: CycleCardData["progress_chart"] = {};
  for (const date of dates) progressChart[date] = history.get(date) ?? null;
  // Today's endpoint observation is more recent than the cycle list counters. Earlier days keep their own scope.
  const counts = history.get(today) ?? cycle;
  return {
    id: cycle.id,
    name: cycle.name,
    project_id: project.id,
    project_detail: {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      logo_props: project.logo_props,
    },
    start_date: cycle.start_date,
    end_date: cycle.end_date,
    total_issues: counts.total_issues,
    completed_issues: counts.completed_issues,
    started_issues: counts.started_issues,
    unstarted_issues: counts.unstarted_issues,
    backlog_issues: counts.backlog_issues,
    cancelled_issues: counts.cancelled_issues,
    progress_chart: progressChart,
    chart_start_date: start,
    chart_end_date: end,
    today,
    days_remaining: Math.max(0, Math.floor((endInstant.getTime() - now.getTime()) / DAY)),
  };
}
