# Epic is now a work item type like any other: ProjectIssueType.level carries the
# hierarchy, so the legacy `is_epic` marker is retired.

from django.db import migrations, models


def lift_legacy_epics(apps, schema_editor):
    """Give epic types a non-leaf level before the marker that identified them goes away.

    ProjectIssueType.level is authoritative, but bindings created before the hierarchy
    feature carry the default 0 — the same level as a task or a bug. An epic that was the
    top of its project's hierarchy must not silently become a leaf, so lift exactly those
    bindings one step above it. Bindings that already have a level keep it.
    """
    IssueType = apps.get_model("db", "IssueType")
    ProjectIssueType = apps.get_model("db", "ProjectIssueType")

    epic_type_ids = list(IssueType.objects.filter(is_epic=True).values_list("id", flat=True))
    if not epic_type_ids:
        return

    IssueType.objects.filter(id__in=epic_type_ids, level=0).update(level=1)
    ProjectIssueType.objects.filter(issue_type_id__in=epic_type_ids, level=0).update(level=1)


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0151_workspace_default_timezone"),
    ]

    operations = [
        migrations.RunPython(lift_legacy_epics, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="issuetype",
            name="is_epic",
        ),
    ]
