from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from plane.services.daily_digest import schedule_slot

pytestmark = pytest.mark.unit


def config(zone="Asia/Shanghai", weekdays=True, send_time="18:00"):
    return SimpleNamespace(user=SimpleNamespace(user_timezone=zone), weekdays_only=weekdays, send_time=send_time)


def test_monday_previous_period_is_friday_and_weekend_has_no_slot():
    monday = datetime(2026, 11, 2, 10, tzinfo=timezone.utc)
    friday = datetime(2026, 10, 30, 10, tzinfo=timezone.utc)
    assert schedule_slot(config(), monday, previous=True) == friday
    assert schedule_slot(config(), datetime(2026, 11, 1, 14, tzinfo=timezone.utc)) == friday


def test_daily_schedule_uses_personal_timezone():
    now = datetime(2026, 11, 2, 9, 59, tzinfo=timezone.utc)
    assert schedule_slot(config(weekdays=False), now) == datetime(2026, 11, 1, 10, tzinfo=timezone.utc)


def test_dst_fall_back_has_only_one_slot_and_spring_gap_moves_forward():
    fall = config("America/New_York", False, "01:30")
    assert schedule_slot(fall, datetime(2026, 11, 1, 7, tzinfo=timezone.utc)) == datetime(
        2026,
        11,
        1,
        5,
        30,
        tzinfo=timezone.utc,
    )
    spring = config("America/New_York", False, "02:30")
    assert schedule_slot(spring, datetime(2026, 3, 8, 8, tzinfo=timezone.utc)) == datetime(
        2026,
        3,
        8,
        7,
        30,
        tzinfo=timezone.utc,
    )
