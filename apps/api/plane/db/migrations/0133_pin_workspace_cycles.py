from django.db import migrations


def pin_cycles(apps, schema_editor):
    # This entry was unavailable before this release. Enable its initial placement;
    # subsequent pin/unpin choices continue to use the existing preferences API.
    preference = apps.get_model("db", "WorkspaceUserPreference")
    preference.objects.using(schema_editor.connection.alias).filter(
        key="active_cycles", deleted_at__isnull=True
    ).update(is_pinned=True)


class Migration(migrations.Migration):
    dependencies = [("db", "0132_project_planning_fields")]
    operations = [migrations.RunPython(pin_cycles, migrations.RunPython.noop)]
