from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0160_feishu_preview_members")]

    operations = [
        migrations.AddField(model_name="state", name="allow_new_work_items", field=models.BooleanField(default=True)),
        migrations.AddField(
            model_name="workspacetemplate", name="is_default_state_template", field=models.BooleanField(default=False)
        ),
        migrations.AddConstraint(
            model_name="workspacetemplate",
            constraint=models.UniqueConstraint(
                fields=("workspace",),
                condition=models.Q(deleted_at__isnull=True, is_default_state_template=True),
                name="unique_workspace_default_state_template",
            ),
        ),
        migrations.AddConstraint(
            model_name="workspacetemplate",
            constraint=models.CheckConstraint(
                condition=models.Q(is_default_state_template=False) | models.Q(kind="project", project__isnull=True),
                name="default_state_template_workspace_project_kind",
            ),
        ),
    ]
