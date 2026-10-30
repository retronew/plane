from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0166_project_disabled_state_groups")]

    operations = [
        migrations.AddField(
            model_name="state",
            name="icon",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=20,
                choices=[
                    (value, value)
                    for value in (
                        "backlog",
                        "unstarted",
                        "started-25",
                        "started-50",
                        "started-75",
                        "started-100",
                        "completed",
                        "cancelled",
                        "queued",
                        "paused",
                        "blocked",
                        "review",
                        "planned",
                        "ready",
                        "active",
                        "feedback",
                        "testing",
                        "verifying",
                        "approval",
                        "rework",
                        "skipped",
                        "archived",
                    )
                ],
            ),
        ),
    ]
