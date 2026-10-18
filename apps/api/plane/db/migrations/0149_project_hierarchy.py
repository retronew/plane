from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0148_project_custom_properties")]

    operations = [
        migrations.AddField(model_name="project", name="hierarchy_enabled", field=models.BooleanField(default=False)),
        migrations.AddField(
            model_name="project", name="hierarchy_default_level", field=models.PositiveIntegerField(default=0)
        ),
    ]
