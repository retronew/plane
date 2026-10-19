import type { EntityMetric } from "./entity-insights-data";

export type InsightMetric = "work-items" | EntityMetric;
export const INSIGHT_METRICS: InsightMetric[] = ["work-items", "projects", "users", "cycles", "modules", "intake"];
