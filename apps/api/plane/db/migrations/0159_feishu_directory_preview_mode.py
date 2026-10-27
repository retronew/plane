from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0158_feishu_admin_directory")]

    operations = [
        migrations.AddField(
            model_name="feishudirectorypreview",
            name="mode",
            field=models.CharField(
                choices=[("unbound", "unbound"), ("all", "all")], default="unbound", max_length=16
            ),
        ),
    ]
