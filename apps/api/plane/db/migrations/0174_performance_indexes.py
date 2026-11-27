# Generated for PLANEBUG-68 performance indexes

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0173_due_reminder_reliability"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="fileasset",
            index=models.Index(
                condition=models.Q(("issue__isnull", False)),
                fields=["issue", "entity_type"],
                name="asset_issue_type_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="issue",
            index=models.Index(
                condition=models.Q(("archived_at__isnull", True), ("deleted_at__isnull", True), ("is_draft", False)),
                fields=["project", "-created_at"],
                name="issue_active_proj_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="issue",
            index=models.Index(
                condition=models.Q(("archived_at__isnull", True), ("deleted_at__isnull", True), ("is_draft", False)),
                fields=["project", "state", "sort_order"],
                name="issue_active_proj_state_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="issue",
            index=models.Index(
                condition=models.Q(("archived_at__isnull", True), ("deleted_at__isnull", True), ("is_draft", False)),
                fields=["workspace", "-created_at"],
                name="issue_active_ws_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="issue",
            index=models.Index(fields=["project", "sequence_id"], name="issue_proj_seq_idx"),
        ),
        migrations.AddIndex(
            model_name="issueactivity",
            index=models.Index(fields=["issue", "created_at"], name="activity_issue_created_idx"),
        ),
        migrations.AddIndex(
            model_name="issuecomment",
            index=models.Index(fields=["issue", "created_at"], name="comment_issue_created_idx"),
        ),
        migrations.AddIndex(
            model_name="workspacesyncevent",
            index=models.Index(fields=["workspace", "created_at"], name="sync_ws_created_idx"),
        ),
    ]
