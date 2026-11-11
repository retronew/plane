import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [("db", "0171_workspace_sync"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="IssueCommentReview",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                (
                    "status",
                    models.CharField(
                        max_length=20, choices=[(s, s) for s in ("justified", "unjustified", "unreviewed")]
                    ),
                ),
                ("content_fingerprint", models.CharField(max_length=32)),
                ("reviewed_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                (
                    "issue",
                    models.ForeignKey(
                        to="db.issue", on_delete=django.db.models.deletion.CASCADE, related_name="comment_review_events"
                    ),
                ),
                (
                    "comment",
                    models.ForeignKey(
                        to="db.issuecomment",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="review_events",
                    ),
                ),
                (
                    "reviewer",
                    models.ForeignKey(
                        to=settings.AUTH_USER_MODEL, null=True, on_delete=django.db.models.deletion.SET_NULL
                    ),
                ),
            ],
            options={
                "db_table": "issue_comment_reviews",
                "ordering": ("-reviewed_at", "-id"),
                "indexes": [models.Index(fields=["issue", "-reviewed_at", "-id"], name="comment_review_latest_idx")],
            },
        )
    ]
