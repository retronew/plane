from django.db import migrations, models


def backfill_sort_order(apps, schema_editor):
    # Include soft-deleted rows so restoring a link preserves its historical position.
    link_model = apps.get_model("db", "WorkspaceUserLink")
    links = link_model._base_manager.using(schema_editor.connection.alias)
    previous_group = None
    position = 0
    batch = []
    for link in links.order_by("workspace_id", "owner_id", "-created_at", "id").iterator(chunk_size=1000):
        group = (link.workspace_id, link.owner_id)
        if group != previous_group:
            previous_group = group
            position = 0
        link.sort_order = position * 10000
        position += 1
        batch.append(link)
        if len(batch) == 1000:
            links.bulk_update(batch, ["sort_order"], batch_size=1000)
            batch = []
    if batch:
        links.bulk_update(batch, ["sort_order"], batch_size=1000)


class Migration(migrations.Migration):
    dependencies = [("db", "0149_project_hierarchy")]

    operations = [
        migrations.AddField(
            model_name="workspaceuserlink",
            name="sort_order",
            field=models.FloatField(default=0),
        ),
        migrations.RunPython(backfill_sort_order, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="workspaceuserlink",
            options={
                "ordering": ("sort_order", "-created_at", "id"),
                "verbose_name": "Workspace User Link",
                "verbose_name_plural": "Workspace User Links",
            },
        ),
    ]
