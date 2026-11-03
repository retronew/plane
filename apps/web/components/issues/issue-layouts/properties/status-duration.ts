const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const units = [
  [365 * DAY, "year"],
  [30 * DAY, "month"],
  [DAY, "day"],
  [HOUR, "hour"],
  [MINUTE, "minute"],
] as const;
const formatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatStateEntryTime(since: Date, locale: string): string {
  const language = locale === "ua" ? "uk-UA" : locale;
  let formatter = dateFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
    dateFormatters.set(language, formatter);
  }
  return formatter.format(since);
}

export function getNextDurationChange(since: number, now: number): number {
  const elapsed = Math.max(0, now - since);
  const [size] = units.find(([threshold]) => elapsed >= threshold) ?? units[units.length - 1]!;
  const nextUnit = since + (Math.floor(elapsed / size) + 1) * size;
  const nextScale = units.reduce<number>(
    (next, [threshold]) => (threshold > elapsed ? Math.min(next, threshold) : next),
    Infinity
  );
  return Math.min(nextUnit, since + nextScale);
}

/** A single whole unit; durations use fixed 24-hour days and 30-day months. */
export function formatTimeInStatus(since: Date, now: Date = new Date(), locale = "en"): string {
  const language = locale === "ua" ? "uk-UA" : locale;
  const elapsed = Math.max(0, now.getTime() - since.getTime());
  const [size, unit] = units.find(([threshold]) => elapsed >= threshold) ?? units[units.length - 1]!;
  const key = `${language}:${unit}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "short" });
    formatters.set(key, formatter);
  }
  return `${elapsed < MINUTE ? "<" : ""}${formatter.format(Math.max(1, Math.floor(elapsed / size)))}`;
}
