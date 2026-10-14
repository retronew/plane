# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    APIToken,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueSubscriber,
    IssueView,
    Notification,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Alpha", identifier="ALP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def other_user(db, workspace):
    user = User.objects.create(email="other@plane.so", username="other")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


def _client(user, role, workspace, projects=(), project_role=None):
    WorkspaceMember.objects.get_or_create(workspace=workspace, member=user, defaults={"role": role})
    for project in projects:
        ProjectMember.objects.create(project=project, member=user, role=project_role or role, is_active=True)
    token = APIToken.objects.create(user=user, label="t", token=f"token-{user.username}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


def _item(project, name, created_by=None, **kwargs):
    issue = Issue.objects.create(name=name, project=project, workspace=project.workspace, **kwargs)
    if created_by is not None:
        # BaseModel.save overwrites created_by with the request user, which tests do not have
        Issue.objects.filter(pk=issue.pk).update(created_by=created_by)
    return issue


def _notify(workspace, receiver, title, **kwargs):
    return Notification.objects.create(
        workspace=workspace,
        receiver=receiver,
        title=title,
        entity_name="issue",
        sender=kwargs.pop("sender", "in_app:issue_activities:assigned"),
        **kwargs,
    )


@pytest.mark.contract
class TestNotifications:
    @pytest.mark.django_db
    def test_list_only_own_and_filters(self, api_key_client, workspace, create_user, other_user):
        unread = _notify(workspace, create_user, "Unread")
        read = _notify(workspace, create_user, "Read", read_at=timezone.now())
        mention = _notify(workspace, create_user, "Mention", sender="in_app:issue_activities:mentioned")
        _notify(workspace, create_user, "Archived", archived_at=timezone.now())
        _notify(workspace, create_user, "Snoozed", snoozed_till=timezone.now() + timedelta(days=1))
        _notify(workspace, other_user, "Not mine")
        url = f"/api/v1/workspaces/{workspace.slug}/notifications/"

        response = api_key_client.get(url)
        assert {n["title"] for n in response.data["results"]} == {"Unread", "Read", "Mention"}

        response = api_key_client.get(url, {"read": "false"})
        assert {str(n["id"]) for n in response.data["results"]} == {str(unread.id), str(mention.id)}

        response = api_key_client.get(url, {"mentioned": "true"})
        assert [n["is_mentioned"] for n in response.data["results"]] == [True]
        assert read.id  # read notification excluded above

        response = api_key_client.get(url, {"archived": "true"})
        assert [n["title"] for n in response.data["results"]] == ["Archived"]

    @pytest.mark.django_db
    def test_unread_count_read_archive_mark_all(self, api_key_client, workspace, create_user, other_user):
        a = _notify(workspace, create_user, "A")
        _notify(workspace, create_user, "B", sender="in_app:issue_activities:mentioned")
        others = _notify(workspace, other_user, "Other")
        base = f"/api/v1/workspaces/{workspace.slug}/notifications/"

        assert api_key_client.get(f"{base}unread-count/").data == {"unread": 2, "unread_mentions": 1}

        assert api_key_client.post(f"{base}{a.id}/read/").status_code == status.HTTP_200_OK
        assert api_key_client.get(f"{base}unread-count/").data["unread"] == 1
        assert api_key_client.delete(f"{base}{a.id}/read/").data["read_at"] is None

        assert api_key_client.post(f"{base}{a.id}/archive/").status_code == status.HTTP_200_OK
        a.refresh_from_db()
        assert a.archived_at is not None

        assert api_key_client.post(f"{base}mark-all-read/").data == {"count": 1}
        others.refresh_from_db()
        assert others.read_at is None

    @pytest.mark.django_db
    def test_cannot_touch_others_notification(self, api_key_client, workspace, other_user):
        theirs = _notify(workspace, other_user, "Theirs")
        response = api_key_client.post(f"/api/v1/workspaces/{workspace.slug}/notifications/{theirs.id}/read/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_guest_can_mark_read(self, workspace):
        guest = User.objects.create(email="g@plane.so", username="g")
        client = _client(guest, 5, workspace)
        mine = _notify(workspace, guest, "Mine")
        response = client.post(f"/api/v1/workspaces/{workspace.slug}/notifications/{mine.id}/read/")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.contract
class TestSearch:
    def _search(self, client, workspace, **params):
        return client.get(f"/api/v1/workspaces/{workspace.slug}/search/", params)

    @pytest.mark.django_db
    def test_finds_by_name_and_identifier(self, api_key_client, workspace, project):
        item = Issue.objects.create(name="Fix login bug", project=project, workspace=workspace)
        response = self._search(api_key_client, workspace, search="login")
        assert [i["id"] for i in response.data["results"]["work_item"]] == [item.id]

        response = self._search(api_key_client, workspace, search=f"ALP-{item.sequence_id}", entities="work_item")
        assert list(response.data["results"]) == ["work_item"]
        assert response.data["results"]["work_item"][0]["identifier"] == f"ALP-{item.sequence_id}"

    @pytest.mark.django_db
    def test_hides_private_pages_and_views_of_others(self, api_key_client, workspace, project, other_user):
        ProjectMember.objects.create(project=project, member=other_user, role=15, is_active=True)
        private = Page.objects.create(
            workspace=workspace, owned_by=other_user, name="Secret plan", access=Page.PRIVATE_ACCESS
        )
        public = Page.objects.create(workspace=workspace, owned_by=other_user, name="Secret public plan")
        for page in (private, public):
            ProjectPage.objects.create(workspace=workspace, project=project, page=page)
        IssueView.objects.create(
            workspace=workspace, project=project, owned_by=other_user, name="Secret view", access=0
        )

        response = self._search(api_key_client, workspace, search="secret", entities="page,view")
        assert [p["id"] for p in response.data["results"]["page"]] == [public.id]
        assert response.data["results"]["view"] == []

    @pytest.mark.django_db
    def test_hides_projects_user_is_not_in(self, api_key_client, workspace):
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace)
        Issue.objects.create(name="Hidden thing", project=hidden, workspace=workspace)
        response = self._search(api_key_client, workspace, search="hid")
        assert response.data["results"]["project"] == []
        assert response.data["results"]["work_item"] == []

    @pytest.mark.django_db
    def test_restricted_guest_sees_only_own_work_items(self, workspace, project, create_user):
        guest = User.objects.create(email="g2@plane.so", username="g2")
        client = _client(guest, 5, workspace, projects=[project])
        _item(project, "Shared task", created_by=create_user)
        own = _item(project, "Shared mine", created_by=guest)
        response = self._search(client, workspace, search="shared", entities="work_item")
        assert [i["id"] for i in response.data["results"]["work_item"]] == [own.id]

    @pytest.mark.django_db
    def test_validation(self, api_key_client, workspace):
        assert self._search(api_key_client, workspace).status_code == status.HTTP_400_BAD_REQUEST
        assert self._search(api_key_client, workspace, search="x", entities="user").status_code == 400


@pytest.mark.contract
class TestMyWork:
    @pytest.mark.django_db
    def test_assigned_created_subscribed(self, api_key_client, workspace, project, create_user, other_user):
        assigned = _item(project, "Assigned", created_by=other_user)
        IssueAssignee.objects.create(issue=assigned, assignee=create_user, project=project, workspace=workspace)
        created = _item(project, "Created", created_by=create_user)
        watched = _item(project, "Watched", created_by=other_user)
        IssueSubscriber.objects.create(issue=watched, subscriber=create_user, project=project, workspace=workspace)
        url = f"/api/v1/workspaces/{workspace.slug}/me/work-items/"

        def ids(work_type):
            return {str(i["id"]) for i in api_key_client.get(url, {"type": work_type}).data["results"]}

        assert ids("assigned") == {str(assigned.id)}
        assert ids("created") == {str(created.id)}
        assert ids("subscribed") == {str(watched.id)}
        assert api_key_client.get(url, {"type": "bogus"}).status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_filters_apply(self, api_key_client, workspace, project, create_user):
        urgent = Issue.objects.create(name="U", project=project, workspace=workspace, priority="urgent")
        low = Issue.objects.create(name="L", project=project, workspace=workspace, priority="low")
        for issue in (urgent, low):
            IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
        response = api_key_client.get(
            f"/api/v1/workspaces/{workspace.slug}/me/work-items/", {"filters": json.dumps({"priority": "urgent"})}
        )
        assert [str(i["id"]) for i in response.data["results"]] == [str(urgent.id)]

    @pytest.mark.django_db
    def test_summary(self, api_key_client, workspace, project, create_user):
        doing = State.objects.create(name="Doing", group="started", project=project, workspace=workspace)
        done = State.objects.create(name="Done", group="completed", project=project, workspace=workspace)
        today = timezone.localdate()
        items = [
            Issue.objects.create(
                name="Late", project=project, workspace=workspace, state=doing, target_date=today - timedelta(days=1)
            ),
            Issue.objects.create(
                name="Soon", project=project, workspace=workspace, state=doing, target_date=today + timedelta(days=3)
            ),
            Issue.objects.create(
                name="Done late",
                project=project,
                workspace=workspace,
                state=done,
                target_date=today - timedelta(days=5),
            ),
        ]
        for issue in items:
            IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)

        data = api_key_client.get(f"/api/v1/workspaces/{workspace.slug}/me/work-items/summary/").data
        assert data["assigned"]["total"] == 3
        assert data["assigned"]["by_state_group"] == {"started": 2, "completed": 1}
        assert data["assigned"]["overdue"] == 1
        assert data["assigned"]["due_next_7_days"] == 1

    @pytest.mark.django_db
    def test_activity_only_mine_in_visible_projects(self, api_key_client, workspace, project, create_user, other_user):
        hidden = Project.objects.create(name="Hidden", identifier="HDN", workspace=workspace)
        issue = Issue.objects.create(name="X", project=project, workspace=workspace)
        mine = IssueActivity.objects.create(
            issue=issue, project=project, workspace=workspace, actor=create_user, verb="updated"
        )
        IssueActivity.objects.create(
            issue=issue, project=project, workspace=workspace, actor=other_user, verb="updated"
        )
        IssueActivity.objects.create(project=hidden, workspace=workspace, actor=create_user, verb="updated")

        response = api_key_client.get(f"/api/v1/workspaces/{workspace.slug}/me/activity/")
        assert [str(a["id"]) for a in response.data["results"]] == [str(mine.id)]
