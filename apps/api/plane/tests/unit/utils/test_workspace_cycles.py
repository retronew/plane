from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from plane.utils.cycle_snapshots import count_cycle_issues
from plane.utils.workspace_cycles import active_cycle_statistics

pytestmark = pytest.mark.unit
NOW = datetime(2026, 10, 16, 1, tzinfo=timezone.utc)


def cycle(days=4):
    return SimpleNamespace(
        project=SimpleNamespace(timezone="Asia/Shanghai"),
        start_date=NOW - timedelta(days=days),
        end_date=NOW + timedelta(days=days),
    )


def test_all_cancelled_or_empty_has_zero_scope_and_no_future_actuals():
    for issues in [[], [{"state__group": "cancelled"}]]:
        stats = active_cycle_statistics(cycle(), count_cycle_issues(issues), NOW)
        assert stats["completed_issues"] == 0
        assert stats["completion_chart"]["2026-10-16"] == 0
        assert stats["completion_chart"]["2026-10-17"] is None
        assert stats["completion_chart"]["2026-10-12"] is None


def test_completion_timestamps_never_create_history_even_when_known():
    issues = [
        {"state__group": "completed", "completed_at": NOW - timedelta(days=10)},
        {"state__group": "completed", "completed_at": None},
        {"state__group": "started", "completed_at": NOW - timedelta(days=2)},
    ]
    stats = active_cycle_statistics(cycle(), count_cycle_issues(issues), NOW)
    assert all(value is None for day, value in stats["completion_chart"].items() if day != "2026-10-16")
    assert stats["completion_chart"]["2026-10-16"] == 1


def test_real_history_retains_its_own_scope_and_state_counts():
    counts = count_cycle_issues([{"state__group": "completed"}])
    yesterday = {
        "progress_date": (NOW - timedelta(days=1)).date(),
        "observed_at": NOW - timedelta(days=1),
        "timezone": "Asia/Shanghai",
        "total_issues": 12,
        "completed_issues": 4,
        "started_issues": 3,
        "unstarted_issues": 2,
        "backlog_issues": 1,
        "cancelled_issues": 2,
    }
    stats = active_cycle_statistics(cycle(), counts, NOW, [yesterday])
    assert stats["completion_chart"]["2026-10-15"] == 6
    assert stats["progress_chart"]["2026-10-15"]["started_issues"] == 3
    assert stats["progress_chart"]["2026-10-14"] is None
    assert stats["progress_chart"]["2026-10-17"] is None


def test_long_cycles_have_bounded_charts_and_keep_today_and_endpoints():
    long = cycle(1000)
    chart = active_cycle_statistics(long, count_cycle_issues([]), NOW)["completion_chart"]
    assert len(chart) <= 368
    assert "2026-10-16" in chart
    assert min(chart) == long.start_date.astimezone(ZoneInfo("Asia/Shanghai")).date().isoformat()


@pytest.mark.parametrize(
    "remaining,expected", [(timedelta(days=7, hours=23), 7), (timedelta(hours=23), 0), (timedelta(0), 0)]
)
def test_remaining_days_counts_full_days_until_the_actual_end_instant(remaining, expected):
    current = cycle()
    current.end_date = NOW + remaining
    assert active_cycle_statistics(current, count_cycle_issues([]), NOW)["days_remaining"] == expected


def test_database_verification_history_has_an_explicit_source_label():
    current = cycle()
    current.external_source = "database-cycle-verification"
    stats = active_cycle_statistics(current, count_cycle_issues([]), NOW)
    assert stats["history_source"] == "manual_test"
    current.external_source = None
    assert active_cycle_statistics(current, count_cycle_issues([]), NOW)["history_source"] == "observed"
