from django.db import transaction
from django.utils import timezone

from plane.db.models import IssueDescriptionVersion, PageVersion


def save_collaboration_history(instance, user_id, *, page=False):
    """Save this exact projection; callers hold the parent row lock throughout the write."""
    model = PageVersion if page else IssueDescriptionVersion
    relation = {"page": instance} if page else {"issue": instance}
    now = timezone.now()
    snapshot = {
        "description_html": instance.description_html,
        "description_json": instance.description_json,
        "description_binary": instance.description_binary,
        "description_stripped": instance.description_stripped,
        "last_saved_at": now,
    }
    with transaction.atomic():
        latest = model.objects.select_for_update().filter(**relation).order_by("-last_saved_at").first()
        if latest and str(latest.owned_by_id) == str(user_id) and (now - latest.last_saved_at).total_seconds() <= 600:
            for field, value in snapshot.items():
                setattr(latest, field, value)
            latest.save(update_fields=[*snapshot, "updated_at"])
        else:
            scope = {"workspace_id": instance.workspace_id}
            if not page:
                scope["project_id"] = instance.project_id
            model.objects.create(**relation, **scope, owned_by_id=user_id, **snapshot)
        if page:
            versions = model.objects.filter(**relation)
            if versions.count() > 20:
                versions.order_by("last_saved_at").first().delete()
