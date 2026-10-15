# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from celery import shared_task
from django.utils import timezone

from plane.utils.cycle_snapshots import current_snapshot_cycles, observe_cycle_progress


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def capture_cycle_progress(project_id=None):
    """Bounded batches, using the real execution time (including on retry)."""
    cycles = current_snapshot_cycles(timezone.now())
    if project_id is not None:
        cycles = cycles.filter(project_id=project_id)
    ids = cycles.order_by("id").values_list("id", flat=True)
    batch, observed = [], 0
    for cycle_id in ids.iterator(chunk_size=100):
        batch.append(cycle_id)
        if len(batch) == 100:
            _, rows = observe_cycle_progress(batch)
            observed += len(rows)
            batch = []
    if batch:
        _, rows = observe_cycle_progress(batch)
        observed += len(rows)
    return {"observed_cycles": observed}
