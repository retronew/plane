# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from plane.db.models import Cycle, CycleProgressSnapshot, Issue

GROUPS = ("backlog", "unstarted", "started", "completed", "cancelled")
COUNT_FIELDS = ("total_issues", *(f"{group}_issues" for group in GROUPS))
SNAPSHOT_FIELDS = (*COUNT_FIELDS, "progress_date", "observed_at", "timezone")


def snapshot_cycles():
    """Shared lifecycle/tenant scope, with caller-specific permissions added by views."""
    return Cycle.objects.filter(
        project__workspace_id=F("workspace_id"),
        project__deleted_at__isnull=True,
        project__archived_at__isnull=True,
        project__cycle_view=True,
        workspace__deleted_at__isnull=True,
        archived_at__isnull=True,
    )


def current_snapshot_cycles(now):
    return snapshot_cycles().filter(start_date__lte=now, end_date__gte=now)


def visible_cycle_issues(cycle_ids):
    return (
        Issue.issue_objects.filter(
            issue_cycle__cycle_id__in=cycle_ids,
            issue_cycle__deleted_at__isnull=True,
            issue_cycle__project_id=F("project_id"),
            issue_cycle__workspace_id=F("workspace_id"),
            issue_cycle__cycle__project_id=F("project_id"),
            issue_cycle__cycle__workspace_id=F("workspace_id"),
            project__workspace_id=F("workspace_id"),
            state__project_id=F("project_id"),
            state__workspace_id=F("workspace_id"),
            state__group__in=GROUPS,
        )
        .values("id", "issue_cycle__cycle_id", "state__group")
        .distinct()
    )


def count_cycle_issues(issues):
    counts = Counter(issue["state__group"] for issue in issues)
    return {"total_issues": len(issues), **{f"{group}_issues": counts[group] for group in GROUPS}}


@transaction.atomic
def observe_cycle_progress(cycle_ids):
    """Observe now, never a queued/request-supplied past date.

    All writers lock cycles in the same order *before* reading tasks and taking
    the clock. This serializes same-day upserts and prevents an older observation
    from overwriting a newer one. Today is mutable; earlier dates are untouched.
    """
    cycles = list(
        snapshot_cycles()
        .filter(id__in=cycle_ids)
        .select_for_update(of=("self",))
        .select_related("project")
        .order_by("id")
    )
    now = timezone.now()
    cycles = [c for c in cycles if c.start_date and c.end_date and c.start_date <= now <= c.end_date]
    if not cycles:
        return now, {}
    by_cycle = defaultdict(list)
    for issue in visible_cycle_issues([c.id for c in cycles]):
        by_cycle[issue["issue_cycle__cycle_id"]].append(issue)
    observations = {
        c.id: {
            **count_cycle_issues(by_cycle[c.id]),
            "progress_date": now.astimezone(ZoneInfo(c.project.timezone)).date(),
            "observed_at": now,
            "timezone": c.project.timezone,
        }
        for c in cycles
    }
    CycleProgressSnapshot.objects.bulk_create(
        [
            CycleProgressSnapshot(cycle=c, project=c.project, workspace_id=c.workspace_id, **observations[c.id])
            for c in cycles
        ],
        update_conflicts=True,
        unique_fields=["cycle", "progress_date"],
        update_fields=[*COUNT_FIELDS, "observed_at", "timezone", "updated_at"],
    )
    return now, observations


def cycle_progress_history(cycle_ids):
    by_cycle = defaultdict(list)
    for snapshot in CycleProgressSnapshot.objects.filter(
        cycle_id__in=cycle_ids,
        project_id=F("cycle__project_id"),
        workspace_id=F("cycle__workspace_id"),
    ).values("cycle_id", *SNAPSHOT_FIELDS):
        by_cycle[snapshot.pop("cycle_id")].append(snapshot)
    return by_cycle
