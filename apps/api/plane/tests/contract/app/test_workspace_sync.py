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


def test_durable_create_update_delete_metadata(workspace, sync_project):
    from plane.db.models import WorkspaceSyncEvent

    issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Secret content")
    event = WorkspaceSyncEvent.objects.latest("id")
    assert event.payload["issue_ids"] == [str(issue.id)]
    assert event.payload["operation"] == "create"
    assert "name" in event.payload["changed_fields"]
    assert "Secret content" not in str(event.payload)
    issue.name = "Changed secret"
    issue.save(update_fields=["name"])
    updated = WorkspaceSyncEvent.objects.latest("id")
    assert updated.cursor > event.cursor
    assert updated.payload["changed_fields"] == ["name"]
    issue.delete(soft=False)
    deleted = WorkspaceSyncEvent.objects.latest("id")
    assert deleted.payload["operation"] == "delete"
    assert deleted.payload["issue_ids"] == [str(issue.id)] or deleted.payload["issue_ids"] == event.payload["issue_ids"]


def test_durable_nested_rollback_does_not_advance_cursor(workspace, sync_project):
    from plane.db.models import WorkspaceSyncCursor, WorkspaceSyncEvent

    first = Issue.objects.create(workspace=workspace, project=sync_project, name="First")
    before = WorkspaceSyncCursor.objects.get(workspace=workspace).cursor
    with transaction.atomic():
        with pytest.raises(ValueError), transaction.atomic():
            first.name = "Rolled back"
            first.save(update_fields=["name"])
            Issue.objects.bulk_create([Issue(workspace=workspace, project=sync_project, name="Rollback bulk")])
            raise ValueError("rollback")
        assert WorkspaceSyncCursor.objects.get(workspace=workspace).cursor == before
        assert not WorkspaceSyncEvent.objects.filter(workspace=workspace, cursor__gt=before).exists()
        first.name = "Committed"
        first.save(update_fields=["name"])
    assert WorkspaceSyncCursor.objects.get(workspace=workspace).cursor == before + 1


def test_durable_log_failure_rolls_back_issue(workspace, sync_project):
    with patch("plane.db.models.WorkspaceSyncEvent.save", side_effect=RuntimeError("durable failure")):
        with pytest.raises(RuntimeError):
            Issue.objects.create(workspace=workspace, project=sync_project, name="Must rollback")
    assert not Issue.all_objects.filter(project=sync_project, name="Must rollback").exists()


def test_changes_replay_pagination_and_permission_filter(session_client, workspace, sync_project, create_user):
    from plane.db.models import WorkspaceSyncEvent

    issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Replay")
    other = Project.objects.create(workspace=workspace, name="Hidden", identifier="HIDE")
    Issue.objects.create(workspace=workspace, project=other, name="Forbidden")
    issue.name = "Second event"
    issue.save(update_fields=["name"])
    url = f"/api/workspaces/{workspace.slug}/sync/changes/"
    cursor, received = "0", []
    while True:
        response = session_client.get(url, {"cursor": cursor, "limit": 1})
        assert response.status_code == 200, response.content
        body = response.json()
        assert not body["reset_required"]
        received.extend(body["events"])
        assert int(body["cursor"]) > int(cursor)
        cursor = body["cursor"]
        if not body["has_more"]:
            break
    assert all(event["project_id"] == str(sync_project.id) for event in received)
    assert len(received) == 2
    assert session_client.get(url, {"cursor": cursor}).json()["events"] == []
    assert cursor == str(WorkspaceSyncEvent.objects.latest("id").cursor)
    ProjectMember.objects.filter(project=sync_project, member=create_user).update(role=5)
    body = session_client.get(url, {"cursor": "0"}).json()
    assert body["events"] == [] and body["cursor"] == cursor
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    assert session_client.get(url).status_code == 403


@pytest.mark.parametrize("cursor", ["invalid", "-1", "999999999999999999999999", "1.0", "１２"])
def test_changes_invalid_cursor_reset(session_client, workspace, sync_project, cursor):
    Issue.objects.create(workspace=workspace, project=sync_project, name="Reset")
    body = session_client.get(f"/api/workspaces/{workspace.slug}/sync/changes/", {"cursor": cursor}).json()
    assert body["reset_required"] is True
    assert body["events"] == []
    assert int(body["cursor"]) > 0


def test_changes_expired_cursor_reset(session_client, workspace, sync_project):
    from datetime import timedelta
    from django.utils import timezone
    from plane.db.models import WorkspaceSyncEvent

    Issue.objects.create(workspace=workspace, project=sync_project, name="Old")
    WorkspaceSyncEvent.objects.filter(workspace=workspace).update(created_at=timezone.now() - timedelta(days=31))
    body = session_client.get(f"/api/workspaces/{workspace.slug}/sync/changes/", {"cursor": "0"}).json()
    assert body["reset_required"] is True


def test_entities_restrict_ids_and_permissions(session_client, workspace, sync_project, create_user):
    from plane.db.models import Cycle, CycleIssue, Module, ModuleIssue

    parent = Issue.objects.create(workspace=workspace, project=sync_project, name="Parent")
    issue = Issue.objects.create(workspace=workspace, project=sync_project, parent=parent, name="Visible")
    cycle = Cycle.objects.create(workspace=workspace, project=sync_project, name="Cycle", owned_by=create_user)
    module = Module.objects.create(workspace=workspace, project=sync_project, name="Module")
    CycleIssue.objects.create(workspace=workspace, project=sync_project, issue=issue, cycle=cycle)
    ModuleIssue.objects.create(workspace=workspace, project=sync_project, issue=issue, module=module)
    missing = uuid4()
    url = f"/api/workspaces/{workspace.slug}/sync/entities/"
    response = session_client.get(url, {"ids": f"{issue.id},{missing}"})
    assert response.status_code == 200, response.content
    body = response.json()
    assert len(body["issues"]) == 1
    assert body["issues"][0]["parent_id"] == str(parent.id)
    assert body["issues"][0]["cycle_id"] == str(cycle.id)
    assert body["issues"][0]["module_ids"] == [str(module.id)]
    assert "description_html" not in body["issues"][0]
    assert body["removed_ids"] == [str(missing)]
    assert int(body["cursor"]) > 0
    assert session_client.get(url, {"ids": ",".join(str(uuid4()) for _ in range(201))}).status_code == 400
    assert session_client.get(url, {"ids": "invalid"}).status_code == 400
    ProjectMember.objects.filter(project=sync_project, member=create_user).update(role=5)
    body = session_client.get(url, {"ids": str(issue.id)}).json()
    assert body["issues"] == [] and body["removed_ids"] == [str(issue.id)]


def test_outbox_retry_preserves_event_identity(workspace, sync_project, settings):
    from plane.db.models import WorkspaceSyncEvent
    from plane.bgtasks.workspace_sync_task import publish_workspace_sync_outbox

    settings.REDIS_URL = "redis://offline"
    Issue.objects.create(workspace=workspace, project=sync_project, name="Durable")
    event = WorkspaceSyncEvent.objects.latest("id")
    with patch("plane.bgtasks.workspace_sync_task.redis.Redis.from_url", side_effect=ConnectionError("offline")):
        assert publish_workspace_sync_outbox() == 0
    event.refresh_from_db()
    assert event.published_at is None
    with patch("plane.bgtasks.workspace_sync_task.redis.Redis.from_url") as connect:
        assert publish_workspace_sync_outbox() >= 1
        payloads = [__import__("json").loads(call.args[1]) for call in connect.return_value.publish.call_args_list]
    payload = next(p for p in payloads if p["event_id"] == str(event.event_id))
    assert payload["cursor"] == str(event.cursor)
    assert payload["issue_ids"] == event.payload["issue_ids"]
    event.refresh_from_db()
    assert event.published_at is not None


def test_baseline_and_archived_entity(session_client, workspace, sync_project):
    from django.utils import timezone

    issue = Issue.objects.create(workspace=workspace, project=sync_project, name="Archive")
    issue.archived_at = timezone.now()
    issue.save(update_fields=["archived_at"])
    baseline = session_client.get(f"/api/workspaces/{workspace.slug}/sync/changes/").json()
    assert baseline["events"] == [] and not baseline["reset_required"]
    body = session_client.get(f"/api/workspaces/{workspace.slug}/sync/entities/", {"ids": str(issue.id)}).json()
    assert body["issues"][0]["id"] == str(issue.id)
    assert body["issues"][0]["archived_at"]


def test_retention_cleanup_preserves_reset_floor(session_client, workspace, sync_project):
    from datetime import timedelta
    from django.utils import timezone
    from plane.db.models import WorkspaceSyncCursor, WorkspaceSyncEvent
    from plane.bgtasks.workspace_sync_task import prune_workspace_sync_log

    Issue.objects.create(workspace=workspace, project=sync_project, name="Expired")
    old = WorkspaceSyncEvent.objects.latest("id")
    WorkspaceSyncEvent.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
    Issue.objects.create(workspace=workspace, project=sync_project, name="Retained")
    assert prune_workspace_sync_log(limit=1) == 1
    assert WorkspaceSyncCursor.objects.get(workspace=workspace).retained_from == old.cursor
    url = f"/api/workspaces/{workspace.slug}/sync/changes/"
    assert session_client.get(url, {"cursor": "0"}).json()["reset_required"]
    body = session_client.get(url, {"cursor": str(old.cursor)}).json()
    assert not body["reset_required"] and len(body["events"]) == 1


def test_request_precise_record_avoids_unknown_fallback(workspace, sync_project):
    from plane.db.models import WorkspaceSyncEvent

    def view(request):
        Issue.objects.create(workspace=workspace, project=sync_project, name="Exact")
        return HttpResponse(status=201)

    request = APIRequestFactory().post("/api/workspaces/test/projects/project/issues/")
    request.resolver_match = ResolverMatch(
        lambda: None, [], {"slug": workspace.slug, "project_id": str(sync_project.id)}
    )
    before = WorkspaceSyncEvent.objects.count()
    WorkspaceSyncInvalidationMiddleware(view)(request)
    records = WorkspaceSyncEvent.objects.all().order_by("id")[before:]
    assert len(records) == 1
    assert records[0].payload["issue_ids"]
    assert records[0].payload["operation"] == "create"


def test_parent_and_relation_fields(workspace, sync_project, create_user):
    from plane.db.models import WorkspaceSyncEvent

    parent = Issue.objects.create(workspace=workspace, project=sync_project, name="Parent")
    child = Issue.objects.create(workspace=workspace, project=sync_project, parent=parent, name="Child")
    created = WorkspaceSyncEvent.objects.latest("id")
    assert set(created.payload["issue_ids"]) == {str(parent.id), str(child.id)}
    assignee = IssueAssignee.objects.create(
        workspace=workspace, project=sync_project, issue=child, assignee=create_user
    )
    relation = WorkspaceSyncEvent.objects.latest("id")
    assert relation.payload["issue_ids"] == [str(child.id)]
    assert relation.payload["changed_fields"] == ["assignee_ids"]
    assignee.delete(soft=False)
    assert WorkspaceSyncEvent.objects.latest("id").payload["changed_fields"] == ["assignee_ids"]


@pytest.mark.django_db(transaction=True)
def test_workspace_cursor_serializes_two_issue_transactions(workspace, sync_project):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from django.db import close_old_connections
    from plane.db.models import WorkspaceSyncCursor, WorkspaceSyncEvent

    first = Issue.objects.create(workspace=workspace, project=sync_project, name="First")
    second = Issue.objects.create(workspace=workspace, project=sync_project, name="Second")
    baseline = WorkspaceSyncCursor.objects.get(workspace=workspace).cursor
    held, release, attempted = Event(), Event(), Event()

    def writer(pk, hold=False):
        close_old_connections()
        try:
            with transaction.atomic():
                item = Issue.objects.get(pk=pk)
                item.name = "Committed first" if hold else "Committed second"
                if not hold:
                    attempted.set()
                item.save(update_fields=["name"])
                cursor = WorkspaceSyncCursor.objects.get(workspace=workspace).cursor
                if hold:
                    held.set()
                    assert release.wait(10)
                return cursor
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        one = pool.submit(writer, first.pk, True)
        assert held.wait(10)
        two = pool.submit(writer, second.pk)
        try:
            assert attempted.wait(10)
            assert WorkspaceSyncCursor.objects.get(workspace=workspace).cursor == baseline
            assert not two.done()
        finally:
            release.set()
        assert one.result(timeout=10) == baseline + 1
        assert two.result(timeout=10) == baseline + 2
    cursors = list(
        WorkspaceSyncEvent.objects.filter(workspace=workspace, cursor__gt=baseline)
        .order_by("cursor")
        .values_list("cursor", flat=True)
    )
    assert cursors == [baseline + 1, baseline + 2]


def test_cross_project_relation_has_project_scoped_ids(workspace, sync_project):
    from plane.db.models import IssueRelation, WorkspaceSyncEvent

    other = Project.objects.create(workspace=workspace, name="Private", identifier="PRIV")
    first = Issue.objects.create(workspace=workspace, project=sync_project, name="Public")
    second = Issue.objects.create(workspace=workspace, project=other, name="Private")
    before = WorkspaceSyncEvent.objects.latest("id").id
    IssueRelation.objects.create(workspace=workspace, project=sync_project, issue=first, related_issue=second)
    records = list(WorkspaceSyncEvent.objects.filter(id__gt=before))
    assert {record.project_id for record in records} == {sync_project.id, other.id}
    for record in records:
        expected = first.id if record.project_id == sync_project.id else second.id
        assert record.payload["issue_ids"] == [str(expected)]


@pytest.mark.django_db(transaction=True)
def test_changes_wait_for_permission_revocation_before_serializing(workspace, sync_project, create_user):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from django.db import close_old_connections
    from rest_framework.test import APIClient

    Issue.objects.create(workspace=workspace, project=sync_project, name="Must not leak")
    revoked, release, requested = Event(), Event(), Event()

    def revoke():
        close_old_connections()
        try:
            with transaction.atomic():
                ProjectMember.objects.filter(project=sync_project, member=create_user).update(role=5)
                revoked.set()
                assert release.wait(10)
        finally:
            close_old_connections()

    def replay():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=create_user)
            requested.set()
            response = client.get(f"/api/workspaces/{workspace.slug}/sync/changes/", {"cursor": "0"})
            assert response.status_code == 200
            return response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        revoke_future = pool.submit(revoke)
        assert revoked.wait(10)
        replay_future = pool.submit(replay)
        try:
            assert requested.wait(10)
        finally:
            release.set()
        revoke_future.result(timeout=10)
        body = replay_future.result(timeout=10)
    assert body["events"] == [] and body["project_ids"] == []
    assert int(body["cursor"]) > 0


@pytest.mark.parametrize("method", ["save", "update", "bulk_update"])
@pytest.mark.parametrize("field", ["state", "name"])
def test_ordinary_child_updates_include_current_parent(workspace, sync_project, method, field):
    from plane.db.models import State, WorkspaceSyncEvent

    parent = Issue.objects.create(workspace=workspace, project=sync_project, name="Parent")
    child = Issue.objects.create(workspace=workspace, project=sync_project, parent=parent, name="Child")
    value = (
        State.objects.create(workspace=workspace, project=sync_project, name="Done", group="completed")
        if field == "state"
        else "Renamed child"
    )
    before = WorkspaceSyncEvent.objects.latest("id").id
    if method == "update":
        assert Issue.objects.filter(pk=child.pk).update(**{field: value}) == 1
    else:
        setattr(child, field, value)
        if method == "save":
            child.save(update_fields=[field])
        else:
            Issue.objects.bulk_update([child], [field])
    child.refresh_from_db()
    assert getattr(child, field) == value
    records = list(WorkspaceSyncEvent.objects.filter(id__gt=before))
    assert len(records) == 1
    assert records[0].project_id == sync_project.id
    assert set(records[0].payload["issue_ids"]) == {str(child.pk), str(parent.pk)}
    assert ("state_id" if field == "state" else field) in records[0].payload["changed_fields"]


@pytest.mark.parametrize("method", ["save", "update", "bulk_update"])
def test_child_reparent_ids_are_grouped_by_project(workspace, sync_project, method):
    from plane.db.models import WorkspaceSyncEvent

    other = Project.objects.create(workspace=workspace, name="Private parent", identifier="PRNT")
    old_parent = Issue.objects.create(workspace=workspace, project=sync_project, name="Old parent")
    new_parent = Issue.objects.create(workspace=workspace, project=other, name="New parent")
    child = Issue.objects.create(workspace=workspace, project=sync_project, parent=old_parent, name="Child")
    before = WorkspaceSyncEvent.objects.latest("id").id
    if method == "update":
        Issue.objects.filter(pk=child.pk).update(parent=new_parent)
    else:
        child.parent = new_parent
        if method == "save":
            child.save(update_fields=["parent"])
        else:
            Issue.objects.bulk_update([child], ["parent"])
    records = list(WorkspaceSyncEvent.objects.filter(id__gt=before))
    assert len(records) == 2
    assert {record.project_id: set(record.payload["issue_ids"]) for record in records} == {
        sync_project.id: {str(child.pk), str(old_parent.pk)},
        other.id: {str(new_parent.pk)},
    }


@pytest.mark.parametrize("method", ["update", "bulk_update"])
def test_multiple_child_updates_keep_project_scoped_parent_ids(workspace, sync_project, method):
    from plane.db.models import WorkspaceSyncEvent

    other = Project.objects.create(workspace=workspace, name="Private children", identifier="CHLD")
    children, expected = [], {}
    for project in [sync_project, other]:
        parent = Issue.objects.create(workspace=workspace, project=project, name="Parent")
        siblings = [
            Issue.objects.create(workspace=workspace, project=project, parent=parent, name=f"Child {index}")
            for index in range(2)
        ]
        children.extend(siblings)
        expected[project.id] = {str(parent.pk), *(str(child.pk) for child in siblings)}
    before = WorkspaceSyncEvent.objects.latest("id").id
    if method == "update":
        assert Issue.objects.filter(pk__in=[child.pk for child in children]).update(name="Changed") == 4
    else:
        for child in children:
            child.name = "Changed"
        Issue.objects.bulk_update(children, ["name"])
    records = list(WorkspaceSyncEvent.objects.filter(id__gt=before))
    assert len(records) == 2
    assert {record.project_id: set(record.payload["issue_ids"]) for record in records} == expected


@pytest.mark.parametrize("method", ["save", "update", "bulk_update"])
def test_ordinary_child_update_rollback_discards_parent_event(workspace, sync_project, method):
    from plane.db.models import WorkspaceSyncCursor, WorkspaceSyncEvent

    parent = Issue.objects.create(workspace=workspace, project=sync_project, name="Parent")
    child = Issue.objects.create(workspace=workspace, project=sync_project, parent=parent, name="Child")
    before = WorkspaceSyncCursor.objects.get(workspace=workspace).cursor
    with pytest.raises(ValueError), transaction.atomic():
        if method == "update":
            Issue.objects.filter(pk=child.pk).update(name="Rolled back")
        else:
            child.name = "Rolled back"
            if method == "save":
                child.save(update_fields=["name"])
            else:
                Issue.objects.bulk_update([child], ["name"])
        event = WorkspaceSyncEvent.objects.latest("id")
        assert set(event.payload["issue_ids"]) == {str(child.pk), str(parent.pk)}
        raise ValueError("rollback child update")
    child.refresh_from_db()
    assert child.name == "Child"
    assert WorkspaceSyncCursor.objects.get(workspace=workspace).cursor == before
    assert not WorkspaceSyncEvent.objects.filter(workspace=workspace, cursor__gt=before).exists()
