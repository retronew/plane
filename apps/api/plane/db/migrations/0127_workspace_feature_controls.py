from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0126_remove_workspace_organization_size")]
    operations = [
        migrations.AddField(
            model_name="workspace", name="allow_member_project_creation", field=models.BooleanField(default=True)
        ),
        migrations.AddField(model_name="workspace", name="ai_enabled", field=models.BooleanField(default=True)),
    ]
