from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0168_issue_started_at_state_changed_at"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="workflowapproval",
            name="previous_state",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="withdrawable_approvals",
                to="db.state",
            ),
        ),
        migrations.AddField(
            model_name="workflowapproval",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="requested_workflow_approvals",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="workflowapproval",
            name="withdrawal",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
