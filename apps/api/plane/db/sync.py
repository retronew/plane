"""Cover background bulk writes which deliberately bypass model signals."""

from django.db import models, transaction


class SyncQuerySet(models.QuerySet):
    def _sync_targets(self):
        from plane.services.workspace_sync import SYNC_MODELS

        if self.model._meta.model_name not in SYNC_MODELS:
            return set()
        return set(self.order_by().values_list("workspace_id", "project_id").distinct())

    def update(self, **kwargs):
        from plane.services.workspace_sync import SYNC_MODELS, invalidate_targets, lock_workspaces

        name = self.model._meta.model_name
        if name not in SYNC_MODELS:
            return super().update(**kwargs)
        with transaction.atomic(using=self.db, savepoint=False):
            targets = self._sync_targets()
            destinations = [kwargs.get("workspace_id"), getattr(kwargs.get("workspace"), "pk", None)]
            destinations = [
                value for value in destinations if value is not None and not hasattr(value, "resolve_expression")
            ]
            lock_workspaces([workspace_id for workspace_id, _ in targets] + destinations, self.db)
            columns = {field.attname for field in self.model._meta.concrete_fields}
            id_field = "pk" if name == "issue" else "issue_id" if "issue_id" in columns else None
            single = list(self.values_list(id_field, flat=True)[:2]) if id_field else []
            issue_ids = single if len(single) == 1 else None
            previous_issues = (
                list(self.values_list("pk", "parent_id", "workspace_id", "project_id")) if name == "issue" else []
            )
            moving = bool({"workspace", "workspace_id", "project", "project_id"}.intersection(kwargs))
            moved_ids = list(self.values_list("pk", flat=True)) if moving else []
            count = super().update(**kwargs)
            if count:
                if moved_ids:
                    targets.update(
                        self.model.all_objects.using(self.db)
                        .filter(pk__in=moved_ids)
                        .values_list("workspace_id", "project_id")
                    )
                fields = []
                for key in kwargs:
                    field = self.model._meta.get_field(key)
                    fields.append(field.attname if field.is_relation and field.name != "estimate_point" else field.name)
                relation_fields = {
                    "issueassignee": "assignee_ids",
                    "issuelabel": "label_ids",
                    "cycleissue": "cycle_id",
                    "moduleissue": "module_ids",
                }
                if name in relation_fields:
                    fields = [relation_fields[name]]
                if name == "issue" and not moving:
                    current_issues = list(
                        self.model.all_objects.using(self.db)
                        .filter(pk__in=[row[0] for row in previous_issues])
                        .values_list("pk", "parent_id", "workspace_id", "project_id")
                    )
                    grouped = {target: set() for target in targets}
                    parent_ids = set()
                    for pk, parent_id, workspace_id, project_id in [*previous_issues, *current_issues]:
                        grouped.setdefault((workspace_id, project_id), set()).add(pk)
                        if parent_id:
                            parent_ids.add(parent_id)
                    # Parents belong only in events for their own project, including
                    # both endpoints of a reparent and batched ordinary child edits.
                    for pk, workspace_id, project_id in (
                        self.model.all_objects.using(self.db)
                        .filter(pk__in=parent_ids)
                        .values_list("pk", "workspace_id", "project_id")
                    ):
                        grouped.setdefault((workspace_id, project_id), set()).add(pk)
                    operation = (
                        "delete" if "deleted_at" in kwargs else "archive" if "archived_at" in kwargs else "update"
                    )
                    for target, target_ids in grouped.items():
                        invalidate_targets(
                            [target],
                            self.db,
                            changed_fields=fields,
                            issue_ids=target_ids,
                            scopes=["issue"],
                            operation=operation,
                        )
                    return count
                # Endpoint/project moves require source/destination reconciliation.
                if moving or {"issue", "issue_id", "related_issue_id"}.intersection(kwargs):
                    issue_ids = None
                operation = "delete" if "deleted_at" in kwargs else "archive" if "archived_at" in kwargs else "update"
                invalidate_targets(
                    targets,
                    self.db,
                    changed_fields=fields,
                    issue_ids=issue_ids,
                    scopes=["issue" if name == "issue" else "comments" if name == "issuecomment" else "relations"],
                    operation=operation,
                )
            return count

    def delete(self, *args, **kwargs):
        from plane.services.workspace_sync import SYNC_MODELS, lock_workspaces

        if self.model._meta.model_name not in SYNC_MODELS:
            return super().delete(*args, **kwargs)
        with transaction.atomic(using=self.db, savepoint=False):
            targets = self._sync_targets()
            lock_workspaces([workspace_id for workspace_id, _ in targets], self.db)
            return super().delete(*args, **kwargs)

    def bulk_update(self, objs, fields, batch_size=None):
        from plane.services.workspace_sync import SYNC_MODELS, lock_workspaces

        if self.model._meta.model_name not in SYNC_MODELS:
            return super().bulk_update(objs, fields, batch_size=batch_size)
        objs = tuple(objs)
        with transaction.atomic(using=self.db, savepoint=False):
            # Lock all workspaces before Django splits this into update batches.
            targets = (
                self.model.all_objects.using(self.db)
                .filter(pk__in=[obj.pk for obj in objs])
                .values_list("workspace_id", flat=True)
            )
            lock_workspaces(list(targets) + [obj.workspace_id for obj in objs], self.db)
            return super().bulk_update(objs, fields, batch_size=batch_size)

    def bulk_create(self, objs, *args, **kwargs):
        from plane.services.workspace_sync import SYNC_MODELS, invalidate_targets, lock_workspaces

        if self.model._meta.model_name not in SYNC_MODELS:
            return super().bulk_create(objs, *args, **kwargs)
        objs = list(objs)
        with transaction.atomic(using=self.db, savepoint=False):
            lock_workspaces([obj.workspace_id for obj in objs], self.db)
            result = super().bulk_create(objs, *args, **kwargs)
            invalidate_targets(
                {(obj.workspace_id, obj.project_id) for obj in objs if obj.workspace_id and obj.project_id},
                self.db,
            )
            return result
