import uuid

from django.db import migrations, models
import django.utils.timezone


def baseline_existing_deliveries(apps, schema_editor):
    # Historical failures cannot be reconstructed. Baseline ALL old deliveries,
    # including opt-outs and deleted notifications, to avoid replay on deployment.
    reminder = apps.get_model("db", "IssueDueReminder")
    reminder._base_manager.using(schema_editor.connection.alias).all().update(
        in_app_processed_at=models.F("created_at")
    )


class Migration(migrations.Migration):
    dependencies = [("db", "0172_issue_comment_review")]
    operations = [
        migrations.AddField(
            model_name="issueduereminder",
            name="in_app_processed_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.RunPython(baseline_existing_deliveries, migrations.RunPython.noop),
        migrations.CreateModel(
            name="DueReminderScanRun",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("finished_at", models.DateTimeField(null=True)),
                (
                    "status",
                    models.CharField(
                        max_length=16,
                        default="running",
                        choices=[(s, s) for s in ("running", "succeeded", "partial", "failed")],
                    ),
                ),
                ("task_id", models.CharField(max_length=255, null=True)),
                *[
                    (name, models.PositiveIntegerField(default=0))
                    for name in (
                        "projects_scanned",
                        "issue_count",
                        "recipient_count",
                        "in_app_created",
                        "feishu_enqueued",
                        "email_queued",
                        "error_count",
                    )
                ],
                ("errors", models.JSONField(default=list)),
            ],
            options={"db_table": "due_reminder_scan_runs"},
        ),
    ]
