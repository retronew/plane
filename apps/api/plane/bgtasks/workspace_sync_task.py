"""At-least-once durable wakeups. Consumers deduplicate by event_id/cursor."""

import json
import logging
from datetime import timedelta

from django.db import transaction

from celery import shared_task
from django.conf import settings
from django.utils import timezone
import redis
from redis.backoff import NoBackoff
from redis.retry import Retry

from plane.db.models import WorkspaceSyncEvent
from plane.services.workspace_sync import CHANNEL

logger = logging.getLogger(__name__)


@shared_task(name="plane.bgtasks.workspace_sync_task.publish_workspace_sync_outbox")
def publish_workspace_sync_outbox(limit=500):
    limit = min(max(int(limit), 1), 500)
    if not settings.REDIS_URL:
        return 0
    client = None
    published = 0
    try:
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            retry_on_timeout=False,
            retry=Retry(NoBackoff(), 0),
        )
        events = (
            WorkspaceSyncEvent.objects.filter(published_at__isnull=True)
            .select_related("workspace")
            .order_by("pk")[:limit]
        )
        for event in events:
            payload = dict(event.payload, workspace_id=str(event.workspace_id), workspace_slug=event.workspace.slug)
            client.publish(CHANNEL, json.dumps(payload))
            WorkspaceSyncEvent.objects.filter(pk=event.pk, published_at__isnull=True).update(
                published_at=timezone.now()
            )
            published += 1
    except Exception:
        logger.warning("Workspace sync outbox publish failed; pending records retained", exc_info=True)
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                logger.warning("Workspace sync Redis close failed", exc_info=True)
    return published


@shared_task(name="plane.bgtasks.workspace_sync_task.prune_workspace_sync_log")
def prune_workspace_sync_log(limit=1000):
    """Bound retention (30 days by default), preserving an explicit reset floor."""
    from plane.services.workspace_sync import lock_workspaces

    cutoff = timezone.now() - timedelta(days=getattr(settings, "WORKSPACE_SYNC_RETENTION_DAYS", 30))
    expired = list(
        WorkspaceSyncEvent.objects.filter(created_at__lt=cutoff)
        .order_by("id")
        .values_list("workspace_id", "cursor")[: min(max(int(limit), 1), 1000)]
    )
    floors = {}
    for workspace_id, cursor in expired:
        floors[workspace_id] = max(floors.get(workspace_id, 0), cursor)
    removed = 0
    with transaction.atomic():
        for row in lock_workspaces(floors):
            row.retained_from = max(row.retained_from, floors[row.workspace_id])
            row.save(update_fields=["retained_from"])
            count, _ = WorkspaceSyncEvent.objects.filter(
                workspace_id=row.workspace_id,
                cursor__lte=row.retained_from,
            ).delete()
            removed += count
    return removed
