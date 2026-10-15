export function progressChartData(distribution: Record<string, number | null>, total: number) {
  // Sort actual dates, not object insertion order. Missing observations stay missing.
  const dates = Object.keys(distribution)
    .filter((key) => Number.isFinite(Date.parse(key)))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a new array for ES2022
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const start = Date.parse(dates[0]);
  const end = Date.parse(dates[dates.length - 1]);
  return dates.map((key) => ({
    timestamp: Date.parse(key),
    current: distribution[key] ?? null,
    ideal: total * (1 - (Date.parse(key) - start) / Math.max(86400000, end - start)),
  }));
}
