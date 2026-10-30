from django.db import migrations, models
from django.db.models import F, OuterRef, Subquery
from django.db.models.functions import Coalesce


def backfill_state_timestamps(apps, schema_editor):
    """Date each issue's current state from its latest state activity, falling back to creation."""
    Issue = apps.get_model("db", "Issue")
    IssueActivity = apps.get_model("db", "IssueActivity")

    last_state_change = (
        IssueActivity._base_manager.filter(issue_id=OuterRef("pk"), field="state")
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    Issue._base_manager.filter(state_changed_at__isnull=True).update(
        state_changed_at=Coalesce(Subquery(last_state_change), F("created_at"))
    )
    # In-progress issues have been started since they entered that state at the latest.
    Issue._base_manager.filter(state__group="started", started_at__isnull=True).update(started_at=F("state_changed_at"))


# The display defaults before this migration. Rows still holding exactly these were never customised,
# so they move to the new defaults: planned start date hidden, time in status shown.
OLD_DEFAULT_DISPLAY_PROPERTIES = {
    "assignee": True,
    "attachment_count": True,
    "created_on": True,
    "due_date": True,
    "estimate": True,
    "key": True,
    "labels": True,
    "link": True,
    "priority": True,
    "start_date": True,
    "state": True,
    "sub_issue_count": True,
    "updated_on": True,
}
DISPLAY_PROPERTY_MODELS = ["ProjectUserProperty", "CycleUserProperties", "ModuleUserProperties", "IssueView"]


def update_default_display_properties(apps, schema_editor):
    for model_name in DISPLAY_PROPERTY_MODELS:
        model = apps.get_model("db", model_name)
        untouched = [
            row
            for row in model._base_manager.only("id", "display_properties").iterator()
            if row.display_properties == OLD_DEFAULT_DISPLAY_PROPERTIES
        ]
        for row in untouched:
            row.display_properties = {**OLD_DEFAULT_DISPLAY_PROPERTIES, "start_date": False, "time_in_status": True}
        model._base_manager.bulk_update(untouched, ["display_properties"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [("db", "0167_state_icon")]
    operations = [
        migrations.AddField(
            model_name="issue", name="started_at", field=models.DateTimeField(blank=True, null=True)
        ),
        migrations.AddField(
            model_name="issue", name="state_changed_at", field=models.DateTimeField(blank=True, null=True)
        ),
        migrations.RunPython(backfill_state_timestamps, migrations.RunPython.noop),
        migrations.RunPython(update_default_display_properties, migrations.RunPython.noop),
    ]
