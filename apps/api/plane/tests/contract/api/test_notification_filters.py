# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from uuid import uuid4

import pytest
from django.utils import timezone

from plane.db.models import Issue, IssueAssignee, Notification, Project, State, User


@pytest.fixture
def notification_data(workspace, create_user):
    project = Project.objects.create(name="Inbox project", identifier="INB", workspace=workspace)
    state = State.objects.create(name="Started", group="started", project=project, workspace=workspace)
    other = User.objects.create(email="inbox-other@example.com", username="inbox-other")
    issue = Issue.objects.create(
        name="Searchable notification issue",
        priority="high",
        state=state,
        project=project,
        workspace=workspace,
        created_by=create_user,
    )
    IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
    common = dict(
        workspace=workspace,
        project=project,
        entity_name="issue",
        entity_identifier=issue.id,
        title="Issue updated",
        sender="issue updated",
        triggered_by=create_user,
        receiver=create_user,
    )
    first = Notification.objects.create(**common)
    mentioned = Notification.objects.create(**{**common, "sender": "mentioned"})
    foreign = Notification.objects.create(**{**common, "receiver": other})
    backlog = State.objects.create(name="Backlog", group="backlog", project=project, workspace=workspace)
    unrelated_issue = Issue.objects.create(
        state=backlog, name="Other issue", priority="low", project=project, workspace=workspace
    )
    second = Notification.objects.create(**{**common, "entity_identifier": unrelated_issue.id, "triggered_by": other})
    return first, second, mentioned, foreign, project, state


def url(workspace):
    return f"/api/workspaces/{workspace.slug}/users/notifications/"


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize(
    "key,value",
    [("priority", "high"), ("state_group", "started"), ("search", "Searchable"), ("type", "assigned,created")],
)
def test_filters_match_current_issue(session_client, workspace, notification_data, key, value):
    first, *_ = notification_data
    response = session_client.get(url(workspace), {key: value})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(first.id)]


@pytest.mark.contract
@pytest.mark.django_db
def test_combined_member_project_filters_and_bulk_read(session_client, workspace, create_user, notification_data):
    first, second, mentioned, foreign, project, _ = notification_data
    params = {
        "assignees": str(create_user.id),
        "triggered_by": str(create_user.id),
        "project": str(project.id),
        "priority": "high,urgent",
    }
    response = session_client.get(url(workspace), params)
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(first.id)]
    assert session_client.post(url(workspace) + "mark-all-read/", params, format="json").status_code == 200
    first.refresh_from_db()
    assert first.read_at is not None
    for notification in [second, mentioned, foreign]:
        notification.refresh_from_db()
        assert notification.read_at is None


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("order", ["created_at", "-created_at", "priority", "unread"])
def test_sorting_with_pagination(session_client, workspace, notification_data, order):
    first, second, *_ = notification_data
    Notification.objects.filter(pk=first.pk).update(
        created_at=timezone.now() - timedelta(days=1), read_at=timezone.now()
    )
    response = session_client.get(url(workspace), {"order_by": order, "per_page": 1, "cursor": "1:0:0"})
    assert response.status_code == 200
    expected = first if order in ("created_at", "priority") else second
    assert response.json()["results"][0]["id"] == str(expected.id)
    next_page = session_client.get(
        url(workspace), {"order_by": order, "per_page": 1, "cursor": response.json()["next_cursor"]}
    )
    assert next_page.status_code == 200
    assert next_page.json()["results"][0]["id"] != str(expected.id)


@pytest.mark.contract
@pytest.mark.django_db
def test_invalid_ids_do_not_expand_results(session_client, workspace, notification_data):
    for project_id in ["invalid", str(uuid4())]:
        response = session_client.get(url(workspace), {"project": project_id})
        assert response.status_code == 200
        assert response.json() == []


@pytest.mark.contract
@pytest.mark.django_db
def test_mentions_boolean_and_bulk_read(session_client, workspace, notification_data):
    first, second, mentioned, foreign, *_ = notification_data
    response = session_client.get(url(workspace), {"mentioned": "false"})
    assert {item["id"] for item in response.json()} == {str(first.id), str(second.id)}
    assert session_client.post(url(workspace) + "mark-all-read/", {"mentioned": True}, format="json").status_code == 200
    mentioned.refresh_from_db()
    assert mentioned.read_at is not None
    for notification in [first, second, foreign]:
        notification.refresh_from_db()
        assert notification.read_at is None


@pytest.mark.contract
@pytest.mark.django_db
def test_browser_feed_is_paginated_from_first_request_and_receiver_scoped(session_client, workspace, notification_data):
    first, second, mentioned, foreign, *_ = notification_data
    response = session_client.get(url(workspace), {"browser_feed": "true"})
    assert response.status_code == 200
    assert {item["id"] for item in response.json()["results"]} == {str(first.id), str(second.id)}
    assert response.json()["next_page_results"] is False
    assert response.json()["next_cursor"] is None
    response = session_client.get(url(workspace), {"browser_feed": "true", "mentioned": "true"})
    assert [item["id"] for item in response.json()["results"]] == [str(mentioned.id)]
    assert str(foreign.id) not in str(response.json())


@pytest.mark.contract
@pytest.mark.django_db
def test_browser_feed_empty_response_has_pagination_shape(session_client, workspace):
    response = session_client.get(url(workspace), {"browser_feed": "true"})
    assert response.status_code == 200
    assert response.json() == {"results": [], "next_page_results": False, "next_cursor": None}


@pytest.mark.contract
@pytest.mark.django_db
def test_browser_feed_keyset_survives_inserts_deletes_and_archiving(session_client, workspace, notification_data):
    first, second, *_ = notification_data
    rows = [
        Notification.objects.create(
            workspace=workspace,
            project=first.project,
            receiver=first.receiver,
            entity_name="issue",
            entity_identifier=first.entity_identifier,
            sender="issue updated",
            title="Browser page test",
        )
        for _ in range(101)
    ]
    # Same timestamp also exercises the UUID tie-breaker.
    timestamp = timezone.now()
    Notification.objects.filter(pk__in=[row.pk for row in rows]).update(created_at=timestamp)
    params = {"browser_feed": "true"}
    response = session_client.get(url(workspace), params)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 100
    assert data["next_page_results"] is True
    seen = {item["id"] for item in data["results"]}
    Notification.objects.filter(pk=data["results"][0]["id"]).delete()
    Notification.objects.filter(pk=data["results"][1]["id"]).update(archived_at=timezone.now())
    remaining = next(row for row in rows if str(row.id) not in seen)
    Notification.objects.filter(pk=remaining.pk).update(snoozed_till=timezone.now() + timedelta(days=1))
    newcomer = Notification.objects.create(
        workspace=workspace,
        project=first.project,
        receiver=first.receiver,
        entity_name="issue",
        sender="issue updated",
        title="Arrived during pagination",
    )
    following = session_client.get(url(workspace), {**params, "cursor": data["next_cursor"]})
    assert following.status_code == 200
    items = following.json()["results"]
    assert {item["id"] for item in items} == {str(remaining.id), str(first.id), str(second.id)}
    assert str(newcomer.id) not in {item["id"] for item in items}
    assert following.json()["next_page_results"] is False
    invalid = session_client.get(url(workspace), {**params, "cursor": data["next_cursor"] + "invalid"})
    assert invalid.status_code == 400
    cross_stream = session_client.get(url(workspace), {**params, "cursor": data["next_cursor"], "mentioned": "true"})
    assert cross_stream.status_code == 400


@pytest.mark.contract
@pytest.mark.django_db
def test_browser_feed_keeps_mutable_status_rows_so_client_can_skip_them(session_client, workspace, notification_data):
    first, second, *_ = notification_data
    Notification.objects.filter(pk=first.pk).update(archived_at=timezone.now(), read_at=timezone.now())
    Notification.objects.filter(pk=second.pk).update(snoozed_till=timezone.now() + timedelta(days=1))
    data = session_client.get(url(workspace), {"browser_feed": "true"}).json()
    assert {item["id"] for item in data["results"]} == {str(first.id), str(second.id)}
    assert session_client.get(url(workspace)).json() == []
