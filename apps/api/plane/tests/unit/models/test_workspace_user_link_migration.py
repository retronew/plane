from datetime import timedelta
from uuid import UUID

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone


@pytest.mark.unit
@pytest.mark.django_db(transaction=True)
def test_quick_link_migration_preserves_history_per_workspace_and_owner(request):
    if request.config.getoption("nomigrations"):
        pytest.skip("Run with --migrations to exercise the historical migration graph.")
    before = [("db", "0149_project_hierarchy")]
    after = [("db", "0150_workspaceuserlink_sort_order")]
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    try:
        executor.migrate(before)
        old_apps = executor.loader.project_state(before).apps
        user_model = old_apps.get_model("db", "User")
        workspace_model = old_apps.get_model("db", "Workspace")
        link_model = old_apps.get_model("db", "WorkspaceUserLink")
        users = [
            user_model.objects.create(email=f"migration{index}@plane.so", username=f"migration{index}")
            for index in range(2)
        ]
        workspaces = [
            workspace_model.objects.create(name=f"Migration {index}", slug=f"migration-{index}", owner_id=users[0].pk)
            for index in range(2)
        ]
        now = timezone.now()
        expected = {}
        for group, (workspace, owner) in enumerate(
            [(workspaces[0], users[0]), (workspaces[0], users[1]), (workspaces[1], users[0])]
        ):
            # Insert in a deliberately different order from both timestamp and UUID order.
            for offset, age, position in [(3, 1, 2), (2, 0, 1), (1, 0, 0)]:
                link = link_model.objects.create(
                    id=UUID(int=group * 10 + offset),
                    workspace_id=workspace.pk,
                    owner_id=owner.pk,
                    url=f"https://migration{group}-{offset}.example",
                )
                link_model.objects.filter(pk=link.pk).update(created_at=now - timedelta(days=age))
                expected[link.pk] = position * 10000
        # Soft-deleted records must be backfilled as well.
        deleted_id = UUID(int=4)
        link_model.objects.create(
            id=deleted_id,
            workspace_id=workspaces[0].pk,
            owner_id=users[0].pk,
            url="https://deleted.example",
            created_at=now - timedelta(days=2),
            deleted_at=now,
        )
        link_model._base_manager.filter(pk=deleted_id).update(created_at=now - timedelta(days=2))
        expected[deleted_id] = 30000

        executor = MigrationExecutor(connection)
        executor.migrate(after)
        new_model = executor.loader.project_state(after).apps.get_model("db", "WorkspaceUserLink")
        actual = dict(new_model._base_manager.values_list("id", "sort_order"))
        assert actual == expected
        assert list(
            new_model._base_manager.filter(workspace_id=workspaces[0].pk, owner_id=users[0].pk)
            .order_by("sort_order", "-created_at", "id")
            .values_list("id", flat=True)
        ) == [UUID(int=value) for value in (1, 2, 3, 4)]
    finally:
        MigrationExecutor(connection).migrate(latest)
