from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0146_project_update_details")]

    operations = [
        migrations.AddField(
            model_name="cycle",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
