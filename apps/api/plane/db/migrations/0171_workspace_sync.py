from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("db", "0170_personal_daily_digest")]
    operations = [
        migrations.CreateModel(
            name="WorkspaceSyncCursor",
            fields=[
                (
                    "workspace",
                    models.OneToOneField(
                        primary_key=True,
                        serialize=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        to="db.workspace",
                    ),
                ),
                ("cursor", models.PositiveBigIntegerField(default=0)),
                ("retained_from", models.PositiveBigIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name="WorkspaceSyncEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="db.workspace")),
                ("project_id", models.UUIDField()),
                ("event_id", models.UUIDField(unique=True)),
                ("cursor", models.PositiveBigIntegerField()),
                ("payload", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("published_at", models.DateTimeField(null=True)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("workspace", "cursor"), name="workspace_sync_cursor_unique")
                ],
                "indexes": [models.Index(fields=["published_at", "id"], name="sync_unpublished_idx")],
            },
        ),
    ]
