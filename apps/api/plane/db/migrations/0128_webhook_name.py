from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0127_workspace_feature_controls")]
    operations = [
        migrations.AddField(
            model_name="webhook", name="name", field=models.CharField(max_length=255, blank=True, default="")
        )
    ]
