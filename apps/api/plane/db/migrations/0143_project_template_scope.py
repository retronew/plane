from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):
    dependencies = [("db", "0142_workflow_retry_history")]

    operations = [
        migrations.RemoveConstraint(model_name="workspacetemplate", name="unique_workspace_template"),
        migrations.AddConstraint(
            model_name="workspacetemplate",
            constraint=models.UniqueConstraint(
                Lower("name"),
                "workspace",
                "kind",
                condition=models.Q(deleted_at__isnull=True, project__isnull=True),
                name="unique_workspace_template",
            ),
        ),
        migrations.AddConstraint(
            model_name="workspacetemplate",
            constraint=models.UniqueConstraint(
                Lower("name"),
                "workspace",
                "project",
                "kind",
                condition=models.Q(deleted_at__isnull=True, project__isnull=False),
                name="unique_project_template",
            ),
        ),
    ]
