"""Best-effort, content-free work item invalidation after database commit."""

import json
import logging
from uuid import uuid4
from contextvars import ContextVar
from time import monotonic

import redis
from redis.backoff import NoBackoff
from redis.retry import Retry
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)
CHANNEL = "plane:sync:v1"
_unavailable_until = 0.0
SYNC_MODELS = frozenset(
    {
        "issue",
        "issueassignee",
        "issuelabel",
        "cycleissue",
        "moduleissue",
        "issuerelation",
        "issueblocker",
        "issuelink",
        "issueattachment",
        "issuecomment",
        "issuereaction",
        "issuevote",
        "intakeissue",
        "state",
        "label",
        "cycle",
        "module",
    }
)


def publish(workspace_id, workspace_slug, project_id, issue_ids=None):
    global _unavailable_until
    if monotonic() < _unavailable_until:
        return
    payload = {
        "type": "invalidate",
        "protocol_version": 1,
        "workspace_id": str(workspace_id),
        "workspace_slug": workspace_slug,
        "project_id": str(project_id),
        "event_id": str(uuid4()),
    }
    if issue_ids:
        payload["issue_ids"] = [str(value) for value in issue_ids][:100]
    client = None
    try:
        if not settings.REDIS_URL:
            return
        # An unavailable broker must never hold CRUD hostage or retry indefinitely.
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            retry_on_timeout=False,
            retry=Retry(NoBackoff(), 0),
        )
        client.publish(CHANNEL, json.dumps(payload))
    except Exception:
        # Bound outage latency for requests touching many projects in this worker.
        # Lost best-effort events are covered by reconnect and client calibration.
        _unavailable_until = monotonic() + 5
        logger.warning("Workspace sync publish failed", exc_info=True)
    finally:
        if client is not None:
            client.close()


def publish_targets(targets, using):
    from plane.db.models import Workspace

    try:
        slugs = dict(
            Workspace.objects.using(using)
            .filter(pk__in={workspace_id for workspace_id, _ in targets})
            .values_list("id", "slug")
        )
        for workspace_id, project_id in targets:
            if workspace_id in slugs:
                publish(workspace_id, slugs[workspace_id], project_id)
    except Exception:
        logger.warning("Workspace sync invalidation failed", exc_info=True)


class RequestInvalidations:
    """Accumulate committed writes without changing the request's transaction semantics."""

    def __init__(self):
        self.targets = {}
        self.finished = False
        self.accepted = False

    def add(self, targets, using):
        if self.finished:
            if self.accepted:
                publish_targets(targets, using)
        else:
            self.targets.setdefault(using, set()).update(targets)

    def finish(self, accepted):
        self.finished = True
        self.accepted = accepted
        if accepted:
            for using, targets in self.targets.items():
                publish_targets(targets, using)
        self.targets.clear()


request_invalidations = ContextVar("workspace_sync_request", default=None)


class CommitInvalidations:
    def __init__(self, targets, using, request_batch):
        self.targets = targets
        self.using = using
        self.request_batch = request_batch
        self.done = False

    def __call__(self):
        self.done = True
        if self.request_batch is not None:
            self.request_batch.add(self.targets, self.using)
        else:
            publish_targets(self.targets, self.using)


def invalidate_targets(targets, using=None):
    """Coalesce within exactly the same savepoint scope, preserving rollback isolation."""
    targets = set(targets)
    if not targets:
        return
    connection = transaction.get_connection(using)
    batch = request_invalidations.get()
    if connection.in_atomic_block:
        savepoints = {sid for sid in connection.savepoint_ids if sid is not None}
        # Django's on_commit queue is the source of truth: callbacks removed by a
        # rollback cannot retain/absorb later writes. Never merge into a callback
        # registered in an outer savepoint, as that would leak rolled-back targets.
        # This small adapter is covered by nested rollback and bulk batch tests.
        for scope, callback, _robust in reversed(connection.run_on_commit):
            if (
                {sid for sid in scope if sid is not None} == savepoints
                and isinstance(callback, CommitInvalidations)
                and not callback.done
                and callback.request_batch is batch
            ):
                callback.targets.update(targets)
                return
    transaction.on_commit(CommitInvalidations(targets, connection.alias, batch), using=connection.alias)


def model_changed(sender, instance, using, **kwargs):
    if sender._meta.model_name in SYNC_MODELS and instance.workspace_id and instance.project_id:
        invalidate_targets([(instance.workspace_id, instance.project_id)], using)


def register_signals():
    from django.db.models.signals import post_delete, post_save

    post_save.connect(model_changed, dispatch_uid="workspace-sync-save", weak=False)
    post_delete.connect(model_changed, dispatch_uid="workspace-sync-delete", weak=False)


def request_invalidation(kwargs):
    from plane.db.models import Project

    slug = kwargs.get("slug") or kwargs.get("workspace_slug")
    if not slug:
        return
    projects = Project.objects.filter(workspace__slug=slug)
    if kwargs.get("project_id"):
        projects = projects.filter(pk=kwargs["project_id"])
    invalidate_targets(projects.values_list("workspace_id", "id"))
