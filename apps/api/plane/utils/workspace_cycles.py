# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from datetime import timedelta
from math import ceil
from zoneinfo import ZoneInfo


def active_cycle_statistics(cycle, counts, now, snapshots=()):
    """Live totals plus observed daily history; absent days always remain null."""
    tz = ZoneInfo(cycle.project.timezone)
    today = now.astimezone(tz).date()
    start = cycle.start_date.astimezone(tz).date()
    end = cycle.end_date.astimezone(tz).date()
    days = (end - start).days
    step = max(1, ceil(days / 365))
    dates = sorted({start + timedelta(days=i) for i in range(0, days + 1, step)} | {today, end})
    history = {
        row["progress_date"]: row
        for row in snapshots
        if start <= row["progress_date"] <= min(today, end) and row["observed_at"] <= now
    }
    chart, progress_chart = {}, {}
    for day in dates:
        row = history.get(day)
        # Today is the same real observation just persisted by the caller.
        # Never infer earlier counts from completion timestamps.
        if day == today:
            row = {**counts, "observed_at": now, "timezone": cycle.project.timezone}
        date = day.isoformat()
        progress_chart[date] = (
            {**row, "progress_date": date, "observed_at": row["observed_at"].isoformat()} if row is not None else None
        )
        chart[date] = (
            max(0, row["total_issues"] - row["cancelled_issues"] - row["completed_issues"]) if row is not None else None
        )
    return {
        **{key: value for key, value in counts.items() if key.endswith("_issues")},
        "completion_chart": chart,
        "progress_chart": progress_chart,
        "chart_start_date": start.isoformat(),
        "chart_end_date": end.isoformat(),
        "today": today.isoformat(),
        "days_remaining": max(0, (cycle.end_date - now).days),
    }
