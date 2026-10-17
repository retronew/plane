# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, ValidationError

from plane.db.models import Cycle
from plane.utils.cycle_snapshots import observe_cycle_progress
from plane.utils.cycle_transfer_issues import transfer_cycle_issues


class CycleAlreadyCompleted(APIException):
    status_code = 409
    default_detail = "Cycle has already been completed"


@transaction.atomic
def complete_cycle(*, slug, project_id, cycle_id, incomplete_action, target_cycle_id, request):
    """Revalidate under ordered cycle locks; all observations/writes roll back together."""
    ids = [cycle_id] + ([target_cycle_id] if target_cycle_id else [])
    cycles = {
        cycle.id: cycle
        for cycle in Cycle.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            project__workspace_id=F("workspace_id"),
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
            project__cycle_view=True,
            workspace__deleted_at__isnull=True,
            id__in=ids,
        )
        .select_for_update(of=("self",))
        .order_by("id")
    }
    source = cycles.get(cycle_id)
    if source is None:
        raise NotFound("Cycle not found")
    if source.completed_at is not None:
        raise CycleAlreadyCompleted()
    now = timezone.now()
    if (
        source.archived_at
        or not source.start_date
        or not source.end_date
        or not (source.start_date <= now <= source.end_date)
    ):
        raise ValidationError("Only a current, unarchived cycle can be completed")

    target = None
    transferred = 0
    if incomplete_action == "transfer":
        target = cycles.get(target_cycle_id)
        if (
            target is None
            or target.id == source.id
            or target.archived_at
            or target.completed_at
            or not (target.start_date and target.end_date and now < target.start_date <= target.end_date)
        ):
            raise ValidationError("Target must be an upcoming, unarchived cycle in this project")
        # Freeze the actual final scope before incomplete work leaves the cycle.
        observed_at, observations = observe_cycle_progress([source.id])
        if source.id not in observations:
            raise ValidationError("Cycle is no longer current")
        result = transfer_cycle_issues(
            slug=slug,
            project_id=project_id,
            cycle_id=source.id,
            new_cycle_id=target.id,
            request=request,
            user_id=request.user.id,
        )
        if not result["success"]:
            raise ValidationError(result["error"])
        transferred = result["transferred_issues_count"]

    else:
        observed_at, observations = observe_cycle_progress([source.id])
        if source.id not in observations:
            raise ValidationError("Cycle is no longer current")
    source.completed_at = observed_at
    source.save(update_fields=["completed_at", "updated_at"])
    return source.id, target.id if target else None, transferred
