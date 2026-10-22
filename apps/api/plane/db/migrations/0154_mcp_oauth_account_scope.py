from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("db", "0153_mcp_oauth")]
    operations = [
        migrations.AlterField(
            model_name="mcpoauthgrant",
            name="workspace",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="db.workspace"
            ),
        ),
    ]
