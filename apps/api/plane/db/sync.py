"""Cover background bulk writes which deliberately bypass model signals."""

from django.db import models, transaction


class SyncQuerySet(models.QuerySet):
    def _sync_targets(self):
        from plane.services.workspace_sync import SYNC_MODELS

        if self.model._meta.model_name not in SYNC_MODELS:
            return set()
        return set(self.order_by().values_list("workspace_id", "project_id").distinct())

    def update(self, **kwargs):
        from plane.services.workspace_sync import SYNC_MODELS, invalidate_targets

        if self.model._meta.model_name not in SYNC_MODELS:
            return super().update(**kwargs)
        with transaction.atomic(using=self.db, savepoint=False):
            targets = self._sync_targets()
            moving = bool({"workspace", "workspace_id", "project", "project_id"}.intersection(kwargs))
            moved_ids = list(self.values_list("pk", flat=True)) if moving else []
            count = super().update(**kwargs)
            if count:
                # Resolve expression/bulk_update destinations as well as source projects.
                if moved_ids:
                    targets.update(
                        self.model.all_objects.using(self.db)
                        .filter(pk__in=moved_ids)
                        .values_list("workspace_id", "project_id")
                    )
                invalidate_targets(targets, self.db)
            return count

    def bulk_create(self, objs, *args, **kwargs):
        from plane.services.workspace_sync import SYNC_MODELS, invalidate_targets

        if self.model._meta.model_name not in SYNC_MODELS:
            return super().bulk_create(objs, *args, **kwargs)
        objs = list(objs)
        with transaction.atomic(using=self.db, savepoint=False):
            result = super().bulk_create(objs, *args, **kwargs)
            invalidate_targets(
                {(obj.workspace_id, obj.project_id) for obj in objs if obj.workspace_id and obj.project_id},
                self.db,
            )
            return result
