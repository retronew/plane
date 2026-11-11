"""Durable, transactionally ordered changes with best-effort Redis wakeups."""

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
        "fileasset",
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
            try:
                client.close()
            except Exception:
                logger.warning("Workspace sync Redis close failed", exc_info=True)


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


def lock_workspaces(workspace_ids, using=None):
    from plane.db.models import WorkspaceSyncCursor

    rows = []
    for workspace_id in sorted(set(filter(None, workspace_ids)), key=str):
        WorkspaceSyncCursor.objects.using(using).get_or_create(workspace_id=workspace_id)
        rows.append(WorkspaceSyncCursor.objects.using(using).select_for_update().get(workspace_id=workspace_id))
    return rows


def record_changes(targets, using=None, issue_ids=None, changed_fields=None, scopes=None, operation="unknown"):
    from plane.db.models import WorkspaceSyncEvent

    targets = {(w, p) for w, p in targets if w and p}
    if not targets:
        return
    with transaction.atomic(using=using):
        rows = {str(row.workspace_id): row for row in lock_workspaces([w for w, _ in targets], using)}
        for workspace_id, project_id in sorted(targets, key=lambda pair: (str(pair[0]), str(pair[1]))):
            row = rows[str(workspace_id)]
            row.cursor += 1
            row.save(using=using, update_fields=["cursor"])
            event_id = uuid4()
            payload = {
                "type": "invalidate",
                "protocol_version": 1,
                "event_id": str(event_id),
                "cursor": str(row.cursor),
                "project_id": str(project_id),
                "operation": operation,
                "scopes": scopes or ["issue"],
            }
            ids = list(dict.fromkeys(str(value) for value in (issue_ids or []) if value))
            if 0 < len(ids) <= 100:
                payload["issue_ids"] = ids
            fields = set(changed_fields or []) - {"id", "created_at", "created_by", "created_by_id"}
            if fields:
                payload["changed_fields"] = sorted(fields)
            WorkspaceSyncEvent.objects.using(using).create(
                workspace_id=workspace_id,
                project_id=project_id,
                event_id=event_id,
                cursor=row.cursor,
                payload=payload,
            )


def invalidate_targets(targets, using=None, **metadata):
    """Coalesce within exactly the same savepoint scope, preserving rollback isolation."""
    targets = set(targets)
    if not targets:
        return
    record_changes(targets, using, **metadata)
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


def model_changing(sender, instance, using, update_fields=None, **kwargs):
    if kwargs.get("raw") or sender._meta.model_name not in SYNC_MODELS:
        return
    lock_workspaces([instance.workspace_id], using)
    previous = sender.all_objects.using(using).filter(pk=instance.pk).values().first() if instance.pk else None
    instance._sync_previous = previous
    instance._sync_update_fields = update_fields
    instance._sync_fields = [
        (field.attname if field.is_relation and field.name != "estimate_point" else field.name)
        for field in sender._meta.concrete_fields
        if field.name not in {"id", "created_at", "created_by"}
        if (update_fields is None or field.name in update_fields or field.attname in update_fields)
        and (previous is None or previous.get(field.attname) != getattr(instance, field.attname))
    ]


def model_changed(sender, instance, using, created=False, signal=None, **kwargs):
    from django.db.models.signals import post_delete

    name = sender._meta.model_name
    origin = kwargs.get("origin")
    origin_model = getattr(origin, "model", type(origin))
    origin_name = getattr(getattr(origin_model, "_meta", None), "model_name", None)
    if (
        kwargs.get("raw")
        or origin_name == "workspace"
        or name not in SYNC_MODELS
        or not instance.workspace_id
        or not instance.project_id
    ):
        return
    deleted = signal is post_delete or bool(getattr(instance, "deleted_at", None))
    fields = list(getattr(instance, "_sync_fields", []))
    previous = getattr(instance, "_sync_previous", None)
    update_fields = getattr(instance, "_sync_update_fields", None)
    if not deleted and (update_fields is None or "updated_at" in update_fields):
        if previous is None or previous.get("updated_at") != instance.updated_at:
            fields.append("updated_at")
    operation = "delete" if deleted else "create" if created else "archive" if "archived_at" in fields else "update"
    ids = [instance.pk] if name == "issue" else [getattr(instance, "issue_id", None)]
    if name in {"issuerelation", "issueblocker"}:
        ids.append(getattr(instance, "related_issue_id", None))
        ids.extend([getattr(instance, "block_id", None), getattr(instance, "blocked_by_id", None)])
    relation_fields = {
        "issueassignee": "assignee_ids",
        "issuelabel": "label_ids",
        "cycleissue": "cycle_id",
        "moduleissue": "module_ids",
    }
    if name in relation_fields:
        fields = [relation_fields[name]]
    if name == "issue":
        ids.append(getattr(instance, "parent_id", None))
        if previous:
            ids.append(previous.get("parent_id"))
    scopes = ["issue" if name == "issue" else "comments" if name == "issuecomment" else "relations"]
    targets = {(instance.workspace_id, instance.project_id)}
    if previous and previous.get("workspace_id") and previous.get("project_id"):
        targets.add((previous["workspace_id"], previous["project_id"]))
    # Group relation endpoints by their own project. Never disclose an ID from a
    # private project in an otherwise visible project's event.
    from plane.db.models import Issue

    grouped = {target: set() for target in targets}
    if name == "issue":
        for target in targets:
            grouped[target].add(instance.pk)
    for issue_id, workspace_id, project_id in (
        Issue.all_objects.using(using)
        .filter(pk__in=[pk for pk in ids if pk])
        .values_list("id", "workspace_id", "project_id")
    ):
        grouped.setdefault((workspace_id, project_id), set()).add(issue_id)
    for target, target_ids in grouped.items():
        invalidate_targets(
            [target], using, issue_ids=target_ids, changed_fields=fields, scopes=scopes, operation=operation
        )


def model_deleting(sender, instance, using, origin=None, **kwargs):
    origin_model = getattr(origin, "model", type(origin))
    origin_name = getattr(getattr(origin_model, "_meta", None), "model_name", None)
    if sender._meta.model_name in SYNC_MODELS and origin_name != "workspace":
        lock_workspaces([instance.workspace_id], using)


def register_signals():
    from django.db.models.signals import post_delete, post_save, pre_save, pre_delete

    pre_delete.connect(model_deleting, dispatch_uid="workspace-sync-before-delete", weak=False)

    pre_save.connect(model_changing, dispatch_uid="workspace-sync-before-save", weak=False)
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
    targets = set(projects.values_list("workspace_id", "id"))
    batch = request_invalidations.get()
    if batch is not None:
        # Existing committed callbacks and surviving on_commit entries are the
        # source of truth. A rolled-back savepoint cannot suppress the fallback.
        connection = transaction.get_connection()
        covered = set(batch.targets.get(connection.alias, set()))
        for _scope, callback, _robust in connection.run_on_commit:
            if isinstance(callback, CommitInvalidations) and callback.request_batch is batch:
                covered.update(callback.targets)
        targets.difference_update(covered)
    invalidate_targets(targets)
