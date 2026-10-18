from datetime import timedelta
from uuid import UUID

import pytest
from django.urls import reverse
from django.utils import timezone

from plane.db.models import User, Workspace, WorkspaceMember, WorkspaceUserLink


def link_url(workspace, link=None):
    kwargs = {"slug": workspace.slug}
    if link is not None:
        kwargs["pk"] = link.pk
    return reverse("workspace-quick-links", kwargs=kwargs)


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceQuickLinkOrdering:
    def test_patch_persists_order_with_stable_ties(self, session_client, create_user, workspace):
        older = WorkspaceUserLink.objects.create(workspace=workspace, owner=create_user, url="https://older.example")
        tied = [
            WorkspaceUserLink.objects.create(
                id=UUID(int=value), workspace=workspace, owner=create_user, url=f"https://tie{value}.example"
            )
            for value in (2, 1)
        ]
        now = timezone.now()
        WorkspaceUserLink.objects.filter(pk=older.pk).update(created_at=now - timedelta(days=1))
        WorkspaceUserLink.objects.filter(pk__in=[link.pk for link in tied]).update(created_at=now)
        assert [str(row["id"]) for row in session_client.get(link_url(workspace)).data] == [
            str(tied[1].pk),
            str(tied[0].pk),
            str(older.pk),
        ]

        response = session_client.patch(link_url(workspace, older), {"sort_order": -0.5}, format="json")
        assert response.status_code == 200
        assert response.data["sort_order"] == -0.5
        older.refresh_from_db()
        assert older.sort_order == -0.5
        assert [str(row["id"]) for row in session_client.get(link_url(workspace)).data] == [
            str(older.pk),
            str(tied[1].pk),
            str(tied[0].pk),
        ]

    def test_new_links_go_first_within_owner_and_workspace(self, session_client, create_user, workspace):
        own = WorkspaceUserLink.objects.create(
            workspace=workspace, owner=create_user, url="https://own.example", sort_order=-20000
        )
        other = User.objects.create(email="other-link@plane.so", username="other-link")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        foreign_link = WorkspaceUserLink.objects.create(
            workspace=workspace, owner=other, url="https://foreign.example", sort_order=-999999
        )
        other_workspace = Workspace.objects.create(name="Other", slug="other-links", owner=create_user)
        WorkspaceUserLink.objects.create(
            workspace=other_workspace, owner=create_user, url="https://elsewhere.example", sort_order=-999999
        )
        for expected in (-30000, -40000):
            response = session_client.post(
                link_url(workspace), {"url": f"https://new{abs(expected)}.example", "sort_order": 9999}, format="json"
            )
            assert response.status_code == 201
            assert response.data["sort_order"] == expected
            rows = session_client.get(link_url(workspace)).data
            assert rows[0]["id"] == response.data["id"]
            assert str(foreign_link.pk) not in [str(row["id"]) for row in rows]
        own.refresh_from_db()
        assert own.sort_order == -20000

    def test_first_link_starts_at_zero(self, session_client, workspace):
        response = session_client.post(link_url(workspace), {"url": "https://first.example"}, format="json")
        assert response.status_code == 201
        assert response.data["sort_order"] == 0

    @pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", "1e309", None, "invalid"])
    def test_invalid_sort_order_rejected(self, session_client, create_user, workspace, value):
        link = WorkspaceUserLink.objects.create(workspace=workspace, owner=create_user, url="https://valid.example")
        response = session_client.patch(link_url(workspace, link), {"sort_order": value}, format="json")
        assert response.status_code == 400
        assert "sort_order" in response.data
        response = session_client.post(
            link_url(workspace), {"url": "https://new.example", "sort_order": value}, format="json"
        )
        assert response.status_code == 400
        link.refresh_from_db()
        assert link.sort_order == 0

    def test_patch_cannot_reorder_another_users_or_workspaces_link(self, session_client, create_user, workspace):
        other = User.objects.create(email="private-link@plane.so", username="private-link")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        other_workspace = Workspace.objects.create(name="Other", slug="private-links", owner=create_user)
        WorkspaceMember.objects.create(workspace=other_workspace, member=create_user, role=20)
        links = [
            WorkspaceUserLink.objects.create(workspace=workspace, owner=other, url="https://private.example"),
            WorkspaceUserLink.objects.create(
                workspace=other_workspace, owner=create_user, url="https://elsewhere.example"
            ),
        ]
        for link in links:
            response = session_client.patch(link_url(workspace, link), {"sort_order": -10000}, format="json")
            assert response.status_code == 404
            link.refresh_from_db()
            assert link.sort_order == 0
        assert session_client.get(link_url(workspace)).data == []

    def test_nonmember_cannot_list_or_patch_links(self, session_client, create_user):
        other_workspace = Workspace.objects.create(name="No access", slug="no-link-access", owner=create_user)
        link = WorkspaceUserLink.objects.create(
            workspace=other_workspace, owner=create_user, url="https://inaccessible.example"
        )
        assert session_client.get(link_url(other_workspace)).status_code == 403
        assert (
            session_client.patch(link_url(other_workspace, link), {"sort_order": -10000}, format="json").status_code
            == 403
        )
        link.refresh_from_db()
        assert link.sort_order == 0
