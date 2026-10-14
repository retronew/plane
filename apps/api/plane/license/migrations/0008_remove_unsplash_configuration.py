# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations


def remove_unsplash_configuration(apps, schema_editor):
    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")
    InstanceConfiguration.objects.filter(key="UNSPLASH_ACCESS_KEY").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0007_remove_instance_is_telemetry_enabled"),
    ]

    operations = [
        migrations.RunPython(remove_unsplash_configuration, migrations.RunPython.noop),
    ]
