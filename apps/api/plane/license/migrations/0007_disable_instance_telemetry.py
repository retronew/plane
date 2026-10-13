# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


def disable_telemetry(apps, schema_editor):
    Instance = apps.get_model("license", "Instance")
    Instance.objects.update(is_telemetry_enabled=False)


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0006_instance_is_current_version_deprecated"),
    ]

    operations = [
        migrations.AlterField(
            model_name="instance",
            name="is_telemetry_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(disable_telemetry, migrations.RunPython.noop),
    ]
