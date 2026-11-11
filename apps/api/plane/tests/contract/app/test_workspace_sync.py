from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import transaction
from django.urls import ResolverMatch
from rest_framework.test import APIRequestFactory
from django.http import HttpResponse

from plane.db.models import Issue, IssueAssignee, Label, Project, ProjectMember, WorkspaceMember
from plane.middleware.workspace_sync import WorkspaceSyncInvalidationMiddleware
from plane.services.workspace_sync import invalidate_targets, publish

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@pytest.fixture
def sync_project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Sync", identifier="SYNC")
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=15)
    return project


def test_access_allowlist_and_membership_revocation(session_client, workspace, sync_project, create_user):
    url = f"/api/workspaces/{workspace.slug}/sync/access/"
    body = session_client.get(url).json()
    assert body == {
        "workspace_id": str(workspace.id),
        "workspace_slug": workspace.slug,
        "project_ids": [str(sync_project.id)],
    }
    member = ProjectMember.objects.get(project=sync_project, member=create_user)
    for changes in [{"role": 5}, {"role": 15, "is_active": False}]:
        ProjectMember.objects.filter(pk=member.pk).update(**changes)
        assert session_client.get(url).json()["project_ids"] == []
    ProjectMember.objects.filter(pk=member.pk).update(role=15, is_active=True)
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    assert session_client.get(url).status_code == 403


def test_access_requires_session(api_client, workspace):
    assert api_client.get(f"/api/workspaces/{workspace.slug}/sync/access/").status_code in {401, 403}


def test_signals_and_bulk_paths_publish_only_after_commit(
    workspace, sync_project, create_user, django_capture_on_commit_callbacks
):
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Private title")
            assert not send.called
        assert send.called
        send.reset_mock()
        with django_capture_on_commit_callbacks(execute=True):
            IssueAssignee.objects.bulk_create(
                [IssueAssignee(workspace=workspace, project=sync_project, issue=issue, assignee=create_user)]
            )
            Issue.objects.filter(pk=issue.pk).update(name="Changed")
            issue.archived_at = None
            Issue.objects.bulk_update([issue], ["archived_at"])
            assert not send.called
        assert send.call_count == 1
        assert all(call.args[2] == sync_project.id for call in send.call_args_list)


def test_rolled_back_changes_do_not_publish(workspace, sync_project, django_capture_on_commit_callbacks):
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(ValueError), transaction.atomic():
                invalidate_targets([(workspace.id, sync_project.id)])
                raise ValueError("rollback")
        send.assert_not_called()


def test_repeated_signal_registration_and_delete_do_not_duplicate_or_recurse(
    workspace, sync_project, django_capture_on_commit_callbacks
):
    from plane.services.workspace_sync import register_signals

    register_signals()
    register_signals()
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Signal once")
        assert send.call_count == 1
        send.reset_mock()
        with django_capture_on_commit_callbacks(execute=True):
            issue.delete(soft=False)
        assert send.call_count == 1


def test_nested_rollback_discards_signal_and_bulk_callbacks(
    workspace, sync_project, django_capture_on_commit_callbacks
):
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            with transaction.atomic():
                with pytest.raises(ValueError), transaction.atomic():
                    issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Rollback")
                    Issue.all_objects.filter(pk=issue.pk).update(name="Rollback bulk")
                    raise ValueError("rollback inner savepoint")
        send.assert_not_called()
        assert not Issue.all_objects.filter(name="Rollback bulk").exists()


def test_bulk_delete_and_update_batches_publish_once_per_project(
    workspace, sync_project, django_capture_on_commit_callbacks
):
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            labels = Label.objects.bulk_create(
                [Label(workspace=workspace, project=sync_project, name=f"Label {index}") for index in range(40)]
            )
            for label in labels:
                label.color = "#ffffff"
            Label.objects.bulk_update(labels, ["color"], batch_size=5)
            Label.objects.filter(pk__in=[label.pk for label in labels]).delete(soft=False)
        assert send.call_count == 1


def test_bulk_move_invalidates_source_and_destination(workspace, sync_project, django_capture_on_commit_callbacks):
    destination = Project.objects.create(workspace=workspace, name="Destination", identifier="DEST")
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            label = Label.objects.create(workspace=workspace, project=sync_project, name="Moved label")
            label.project = destination
            Label.objects.bulk_update([label], ["project"])
        assert {call.args[2] for call in send.call_args_list} == {sync_project.id, destination.id}


def test_inner_rollback_does_not_merge_into_outer_callback(workspace, sync_project, django_capture_on_commit_callbacks):
    other_project_id = uuid4()
    with patch("plane.services.workspace_sync.publish") as send:
        with django_capture_on_commit_callbacks(execute=True):
            invalidate_targets([(workspace.id, sync_project.id)])
            with pytest.raises(ValueError), transaction.atomic():
                invalidate_targets([(workspace.id, other_project_id)])
                raise ValueError("rollback")
        send.assert_called_once_with(workspace.id, workspace.slug, sync_project.id)


@pytest.mark.parametrize("status,expected", [(200, 1), (400, 0)])
def test_request_batch_coalesces_committed_signals_and_discards_failed_responses(
    workspace, sync_project, django_capture_on_commit_callbacks, status, expected
):
    def view(request):
        with django_capture_on_commit_callbacks(execute=True):
            for _ in range(20):
                invalidate_targets([(workspace.id, sync_project.id)])
        return HttpResponse(status=status)

    request = APIRequestFactory().post("/api/workspaces/test/issues/")
    request.resolver_match = None
    with patch("plane.services.workspace_sync.publish") as send:
        WorkspaceSyncInvalidationMiddleware(view)(request)
        assert send.call_count == expected


@pytest.mark.parametrize(
    "method,status,expected", [("GET", 200, False), ("POST", 400, False), ("PATCH", 200, True), ("DELETE", 204, True)]
)
def test_request_fallback_only_successful_writes(method, status, expected):
    request = APIRequestFactory().generic(method, "/api/workspaces/test/projects/project/issues/")
    request.resolver_match = ResolverMatch(lambda: None, [], {"slug": "test", "project_id": str(uuid4())})
    middleware = WorkspaceSyncInvalidationMiddleware(lambda _: HttpResponse(status=status))
    with patch("plane.middleware.workspace_sync.request_invalidation") as invalidate:
        middleware(request)
        assert invalidate.called is expected


def test_redis_failure_is_best_effort_and_backoff_bounds_request_latency(settings, monkeypatch):
    import plane.services.workspace_sync as sync

    settings.REDIS_URL = "redis://unavailable:6379"
    monkeypatch.setattr(sync, "_unavailable_until", 0)
    with patch("plane.services.workspace_sync.redis.Redis.from_url", side_effect=ConnectionError("offline")) as connect:
        for _ in range(20):
            publish(uuid4(), "test", uuid4())
        assert connect.call_count == 1
