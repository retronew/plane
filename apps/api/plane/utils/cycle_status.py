# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from django.db.models import Case, CharField, Q, Value, When
from django.utils import timezone


def cycle_completed_q(now=None, prefix=""):
    """Explicit completion and natural expiry share the same lifecycle rules."""
    now = now or timezone.now()
    return Q(**{f"{prefix}completed_at__isnull": False}) | Q(**{f"{prefix}end_date__lt": now})


def is_cycle_completed(cycle, now=None):
    now = now or timezone.now()
    return cycle.completed_at is not None or (cycle.end_date is not None and cycle.end_date < now)


def cycle_status_case(now=None):
    now = now or timezone.now()
    return Case(
        When(cycle_completed_q(now), then=Value("COMPLETED")),
        When(start_date__lte=now, end_date__gte=now, then=Value("CURRENT")),
        When(start_date__gt=now, then=Value("UPCOMING")),
        default=Value("DRAFT"),
        output_field=CharField(),
    )
