from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0161_state_creation_defaults")]

    operations = [
        # Preserve every existing name: its origin cannot be inferred reliably.
        migrations.AddField(
            model_name="user",
            name="is_display_name_custom",
            field=models.BooleanField(default=True),
        ),
    ]
