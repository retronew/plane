"""Shared current-snapshot trend semantics for workspace and project analytics."""

from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone


def work_item_trend(queryset, start, end, daily=False):
    end = min(end, timezone.localdate())
    buckets = {}
    truncate = TruncDate if daily else TruncMonth
    for field, key in [("created_at", "created_issues"), ("completed_at", "completed_issues")]:
        scoped = queryset.filter(**{f"{field}__date__gte": start, f"{field}__date__lte": end})
        if field == "completed_at":
            scoped = scoped.filter(state__group="completed")
        for row in (
            scoped.order_by()
            .annotate(bucket=truncate(field))
            .values("bucket")
            .annotate(count=Count("id", distinct=True))
        ):
            name = row["bucket"].strftime("%Y-%m-%d")
            buckets.setdefault(name, {"created_issues": 0, "completed_issues": 0})[key] = row["count"]
    rows = []
    cursor = start if daily else start.replace(day=1)
    if start <= end:
        while cursor <= end:
            key = cursor.isoformat()
            values = buckets.get(key, {"created_issues": 0, "completed_issues": 0})
            rows.append({"key": key, "name": key, "count": values["created_issues"], **values})
            cursor = (
                cursor + timedelta(days=1) if daily else (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
            )
    result = {
        "data": rows,
        "schema": {key: key for key in ["created_issues", "completed_issues"]},
        "granularity": "day" if daily else "month",
    }
    if start <= end:
        result["period"] = {"start": start.isoformat(), "end": end.isoformat()}
    return result


def filter_trend_scope(queryset, params):
    if params.get("cycle_id"):
        queryset = queryset.filter(issue_cycle__cycle_id=params["cycle_id"], issue_cycle__deleted_at__isnull=True)
    if params.get("module_id"):
        queryset = queryset.filter(issue_module__module_id=params["module_id"], issue_module__deleted_at__isnull=True)
    return queryset
