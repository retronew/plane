from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0159_feishu_directory_preview_mode")]
    operations = [
        migrations.AddField(model_name="feishudirectorypreview", name="members", field=models.JSONField(default=list)),
    ]
