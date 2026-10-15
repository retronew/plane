# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import timedelta
from itertools import groupby

# Django import
from django.db import models
from django.db.models import Case, CharField, Count, F, Sum, Value, When, FloatField
from django.db.models.functions import (
    Coalesce,
    Concat,
    ExtractMonth,
    ExtractYear,
    Cast,
)
from django.utils import timezone

# Module imports
from plane.db.models import Issue, Project

VALID_ANALYTICS_FIELDS = [
    "state_id",
    "state__group",
    "labels__id",
    "assignees__id",
    "estimate_point__value",
    "issue_cycle__cycle_id",
    "issue_module__module_id",
    "priority",
    "start_date",
    "target_date",
    "created_at",
    "completed_at",
]

VALID_YAXIS = ["issue_count", "estimate"]


def annotate_with_monthly_dimension(queryset, field_name, attribute):
    # Get the year and the months
    year = ExtractYear(field_name)
    month = ExtractMonth(field_name)
    # Concat the year and month
    dimension = Concat(year, Value("-"), month, output_field=CharField())
    # Annotate the dimension
    return queryset.annotate(**{attribute: dimension})


def extract_axis(queryset, x_axis):
    if x_axis not in VALID_ANALYTICS_FIELDS:
        raise ValueError(f"Invalid x_axis value: {x_axis}")
    # Format the dimension when the axis is in date
    if x_axis in ["created_at", "start_date", "target_date", "completed_at"]:
        queryset = annotate_with_monthly_dimension(queryset, x_axis, "dimension")
        return queryset, "dimension"
    else:
        return queryset.annotate(dimension=F(x_axis)), "dimension"


def sort_data(data, temp_axis):
    # When the axis is in priority order by
    if temp_axis == "priority":
        order = ["low", "medium", "high", "urgent", "none"]
        return {key: data[key] for key in order if key in data}
    else:
        return dict(sorted(data.items(), key=lambda x: (x[0] == "none", x[0])))


def build_graph_plot(queryset, x_axis, y_axis, segment=None):
    if x_axis not in VALID_ANALYTICS_FIELDS:
        raise ValueError(f"Invalid x_axis value: {x_axis}")
    if y_axis not in VALID_YAXIS:
        raise ValueError(f"Invalid y_axis value: {y_axis}")
    if segment and segment not in VALID_ANALYTICS_FIELDS:
        raise ValueError(f"Invalid segment value: {segment}")

    # temp x_axis
    temp_axis = x_axis
    # Extract the x_axis and queryset
    queryset, x_axis = extract_axis(queryset, x_axis)
    if x_axis == "dimension":
        queryset = queryset.exclude(dimension__isnull=True)

    #
    if segment in ["created_at", "start_date", "target_date", "completed_at"]:
        queryset = annotate_with_monthly_dimension(queryset, segment, "segmented")
        segment = "segmented"

    queryset = queryset.values(x_axis)

    # Issue count
    if y_axis == "issue_count":
        queryset = queryset.annotate(
            is_null=Case(
                When(dimension__isnull=True, then=Value("None")),
                default=Value("not_null"),
                output_field=models.CharField(max_length=8),
            ),
            dimension_ex=Coalesce("dimension", Value("null")),
        ).values("dimension")
        queryset = queryset.annotate(segment=F(segment)) if segment else queryset
        queryset = queryset.values("dimension", "segment") if segment else queryset.values("dimension")
        queryset = queryset.annotate(count=Count("*")).order_by("dimension")

    # Estimate
    else:
        queryset = queryset.annotate(estimate=Sum(Cast("estimate_point__value", FloatField()))).order_by(x_axis)
        queryset = queryset.annotate(segment=F(segment)) if segment else queryset
        queryset = (
            queryset.values("dimension", "segment", "estimate") if segment else queryset.values("dimension", "estimate")
        )

    result_values = list(queryset)
    grouped_data = {str(key): list(items) for key, items in groupby(result_values, key=lambda x: x[str("dimension")])}

    return sort_data(grouped_data, temp_axis)


def burndown_plot(queryset, slug, project_id, plot_type, cycle_id=None, module_id=None):
    """Reconstruct remaining work within today's non-cancelled scope, not historical scope."""
    from math import isfinite
    from zoneinfo import ZoneInfo

    project = Project.objects.get(workspace__slug=slug, pk=project_id)
    tz = ZoneInfo(project.timezone)
    today = timezone.now().astimezone(tz).date()
    start = queryset.start_date
    end = queryset.end_date if cycle_id else queryset.target_date
    if not start or not end:
        return {}
    if cycle_id:
        start, end = start.astimezone(tz).date(), end.astimezone(tz).date()
    relation = "issue_cycle" if cycle_id else "issue_module"
    relation_id = "cycle_id" if cycle_id else "module_id"
    items = list(
        Issue.issue_objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            **{f"{relation}__{relation_id}": cycle_id or module_id, f"{relation}__deleted_at__isnull": True},
        )
        .exclude(state__group="cancelled")
        .values("id", "state__group", "completed_at", "estimate_point__value")
        .distinct()
    )

    def weight(item):
        if plot_type != "points":
            return 1
        try:
            value = float(item["estimate_point__value"])
            return value if isfinite(value) and value >= 0 else 0
        except (ValueError, TypeError):
            return 0

    scope = sum(weight(item) for item in items)
    completed = [item for item in items if item["state__group"] == "completed"]
    unknown = any(item["completed_at"] is None and weight(item) > 0 for item in completed)
    chart = {}
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        if day > today or (unknown and day < today):
            chart[day.isoformat()] = None
            continue
        done = sum(
            weight(item)
            for item in completed
            if day == today or (item["completed_at"] and item["completed_at"].astimezone(tz).date() <= day)
        )
        chart[day.isoformat()] = max(0, scope - done)
    return chart
