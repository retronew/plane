from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("db", "0162_user_display_name_ownership")]

    operations = [
        migrations.CreateModel(
            name="IssueDescriptionDocument",
            fields=[
                (
                    "issue",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="collaboration_document",
                        serialize=False,
                        to="db.issue",
                    ),
                ),
                ("format", models.CharField(default="slate-yjs-v1", editable=False, max_length=32)),
                ("schema_version", models.PositiveIntegerField(default=1)),
                ("epoch", models.PositiveBigIntegerField(default=0)),
                ("revision", models.PositiveBigIntegerField(default=0)),
                ("state", models.BinaryField(editable=False, null=True)),
                ("source_hash", models.CharField(blank=True, default="", max_length=64)),
                ("contributors", models.JSONField(default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "issue_description_documents"},
        ),
    ]
