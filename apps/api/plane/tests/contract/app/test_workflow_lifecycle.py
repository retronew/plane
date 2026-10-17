from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.response import Response

from plane.db.models import Issue, Project, ProjectMember, State, User, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowApproval
from plane.services.workflow_lifecycle import workflow_lifecycle_endpoint

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def lifecycle_ctx(workspace, create_user, monkeypatch):
    from plane.api.views import issue as public_issues
    from plane.api.views import project as public_projects
    from plane.app.views.issue import archive as issue_archive
    from plane.app.views.issue import base as issue_base
    from plane.app.views.project import base as project_base
    from plane.app.views.project import member as project_members

    for module in (public_issues, issue_archive, issue_base):
        monkeypatch.setattr(module.issue_activity, "delay", Mock())
    for module in (public_projects, project_base):
        monkeypatch.setattr(module.webhook_activity, "delay", Mock())
    monkeypatch.setattr(project_members.project_add_user_email, "delay", Mock())
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Lifecycle", identifier="LIFE")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    member = User.objects.create(email="lifecycle-member@example.invalid", username="lifecycle-member")
    workspace_member = WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    project_member = ProjectMember.objects.create(project=project, member=member, role=15)
    source = State.objects.create(project=project, name="Completed approval", group="completed", default=True)
    workflow = ProjectWorkflow.objects.create(project=project, enabled=True)
    issue = Issue.objects.create(project=project, state=source, name="Pending lifecycle")
    pending = WorkflowApproval.objects.create(project=project, issue=issue, workflow=workflow, source=source)
    other_issue = Issue.objects.create(project=project, state=source, name="Other pending lifecycle")
    other_pending = WorkflowApproval.objects.create(
        project=project, issue=other_issue, workflow=workflow, source=source
    )
    project.refresh_from_db()
    return SimpleNamespace(
        workspace=workspace,
        user=create_user,
        project=project,
        member=member,
        workspace_member=workspace_member,
        project_member=project_member,
        source=source,
        issue=issue,
        pending=pending,
        other_issue=other_issue,
        other_pending=other_pending,
        version=project.workflow_version,
        base=f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
    )


@pytest.mark.parametrize("use_api", [False, True])
@pytest.mark.parametrize("action", ["role", "deactivate", "delete", "create"])
def test_project_member_mutation_invalidates_pending_decisions(request, lifecycle_ctx, use_api, action):
    ctx = lifecycle_ctx
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    if use_api and action == "deactivate":
        pytest.skip("The public member update contract exposes role only; DELETE handles deactivation.")
    base = ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base
    url = base + f"members/{ctx.project_member.id}/"
    if action == "delete":
        response = client.delete(url)
    elif action == "create":
        user = User.objects.create(email="new-lifecycle@example.invalid", username="new-lifecycle")
        WorkspaceMember.objects.create(workspace=ctx.workspace, member=user, role=15)
        payload = (
            {"member": str(user.id), "role": 15} if use_api else {"members": [{"member_id": str(user.id), "role": 15}]}
        )
        response = client.post(base + "members/", payload, format="json")
    else:
        response = client.patch(url, {"role": 5} if action == "role" else {"is_active": False}, format="json")
    assert response.status_code in (200, 201, 204), response.data
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    ctx.other_pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert ctx.pending.status == ctx.other_pending.status == "cancelled"
    assert ctx.pending.invalidation_reason == "members_changed"


@pytest.mark.parametrize("action", ["role", "deactivate", "delete"])
def test_workspace_membership_mutation_invalidates_all_projects(session_client, lifecycle_ctx, action):
    ctx = lifecycle_ctx
    other_project = Project.objects.create(workspace=ctx.workspace, name="Second lifecycle", identifier="LIF2")
    ProjectMember.objects.create(project=other_project, member=ctx.user, role=20)
    ProjectMember.objects.create(project=other_project, member=ctx.member, role=15)
    source = State.objects.create(project=other_project, name="Review", group="started")
    workflow = ProjectWorkflow.objects.create(project=other_project, enabled=True)
    issue = Issue.objects.create(project=other_project, state=source, name="Second pending")
    pending = WorkflowApproval.objects.create(project=other_project, issue=issue, workflow=workflow, source=source)
    other_project.refresh_from_db()
    old_version = other_project.workflow_version
    url = f"/api/workspaces/{ctx.workspace.slug}/members/{ctx.workspace_member.id}/"
    response = (
        session_client.delete(url)
        if action == "delete"
        else session_client.patch(url, {"role": 5} if action == "role" else {"is_active": False}, format="json")
    )
    assert response.status_code in (200, 204), response.data
    for approval in (ctx.pending, ctx.other_pending, pending):
        approval.refresh_from_db()
        assert approval.status == "cancelled"
    ctx.project.refresh_from_db()
    other_project.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert other_project.workflow_version == old_version + 1


@pytest.mark.parametrize("scope", ["project", "workspace"])
def test_leaving_membership_invalidates_pending(session_client, lifecycle_ctx, scope):
    ctx = lifecycle_ctx
    session_client.force_authenticate(user=ctx.member)
    url = ctx.base + "members/leave/" if scope == "project" else f"/api/workspaces/{ctx.workspace.slug}/members/leave/"
    response = session_client.post(url, {}, format="json")
    assert response.status_code == 204, response.data
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert ctx.pending.status == "cancelled"


@pytest.mark.parametrize("action", ["archive", "bulk_archive", "delete", "bulk_delete", "public_delete"])
def test_issue_lifecycle_only_cancels_affected_pending(request, lifecycle_ctx, action):
    ctx = lifecycle_ctx
    client = request.getfixturevalue("api_key_client" if action == "public_delete" else "session_client")
    if action == "archive":
        response = client.post(ctx.base + f"issues/{ctx.issue.id}/archive/", {}, format="json")
    elif action == "bulk_archive":
        response = client.post(ctx.base + "bulk-archive-issues/", {"issue_ids": [str(ctx.issue.id)]}, format="json")
    elif action == "bulk_delete":
        response = client.delete(ctx.base + "bulk-delete-issues/", {"issue_ids": [str(ctx.issue.id)]}, format="json")
    elif action == "public_delete":
        response = client.delete(ctx.base.replace("/api/", "/api/v1/") + f"work-items/{ctx.issue.id}/")
    else:
        response = client.delete(ctx.base + f"issues/{ctx.issue.id}/")
    assert response.status_code in (200, 204), response.data
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    ctx.other_pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert ctx.pending.status == "cancelled"
    assert ctx.pending.invalidation_reason == ("issue_archived" if "archive" in action else "issue_deleted")
    assert ctx.other_pending.status == "pending"


@pytest.mark.parametrize("use_api", [False, True])
@pytest.mark.parametrize("action", ["archive", "delete"])
def test_project_lifecycle_invalidates_all_pending(request, lifecycle_ctx, use_api, action):
    ctx = lifecycle_ctx
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    base = ctx.base.replace("/api/", "/api/v1/") if use_api else ctx.base
    response = client.post(base + "archive/", {}, format="json") if action == "archive" else client.delete(base)
    assert response.status_code in (200, 204), response.data
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    ctx.other_pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert ctx.pending.status == ctx.other_pending.status == "cancelled"
    assert ctx.pending.invalidation_reason == ("project_archived" if action == "archive" else "project_deleted")


def test_failed_archive_and_rejected_membership_do_not_invalidate(session_client, lifecycle_ctx):
    ctx = lifecycle_ctx
    State.objects.filter(pk=ctx.source.pk).update(group="started")
    response = session_client.post(ctx.base + f"issues/{ctx.issue.id}/archive/", {}, format="json")
    assert response.status_code == 400, response.data
    response = session_client.patch(ctx.base + f"members/{ctx.project_member.id}/", {"role": 999}, format="json")
    assert response.status_code == 400, response.data
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version
    assert ctx.pending.status == "pending"


def test_automatic_archive_invalidates_only_eligible_issues(
    lifecycle_ctx, monkeypatch, django_capture_on_commit_callbacks
):
    from plane.bgtasks import issue_automation_task as tasks

    ctx = lifecycle_ctx
    Project.objects.filter(pk=ctx.project.pk).update(archive_in=7)
    Issue.objects.filter(pk=ctx.issue.pk).update(updated_at=timezone.now() - timedelta(days=8))
    monkeypatch.setattr(tasks.issue_activity, "delay", Mock())
    with django_capture_on_commit_callbacks(execute=True):
        tasks.archive_old_issues()
        tasks.issue_activity.delay.assert_not_called()
    ctx.project.refresh_from_db()
    ctx.issue.refresh_from_db()
    ctx.pending.refresh_from_db()
    ctx.other_pending.refresh_from_db()
    assert ctx.project.workflow_version == ctx.version + 1
    assert ctx.issue.archived_at is not None
    assert ctx.pending.status == "cancelled"
    assert ctx.other_pending.status == "pending"
    tasks.issue_activity.delay.assert_called_once()


@pytest.mark.django_db(transaction=True)
def test_lifecycle_wrapper_rolls_back_mutation_and_invalidation_together(lifecycle_ctx):
    ctx = lifecycle_ctx

    class Endpoint:
        @workflow_lifecycle_endpoint("members_changed")
        def mutate(self, request, slug, project_id):
            assert connection.in_atomic_block
            ProjectMember.objects.filter(pk=ctx.project_member.pk).update(is_active=False)
            return Response({"error": "failed after write"}, status=400)

    response = Endpoint().mutate(SimpleNamespace(data={}), ctx.workspace.slug, ctx.project.id)
    assert response.status_code == 400
    ctx.project_member.refresh_from_db()
    ctx.project.refresh_from_db()
    ctx.pending.refresh_from_db()
    assert ctx.project_member.is_active
    assert ctx.project.workflow_version == ctx.version
    assert ctx.pending.status == "pending"


@pytest.mark.parametrize("use_api", [False, True])
def test_ordinary_issue_patch_cannot_bypass_lifecycle_endpoints(request, lifecycle_ctx, use_api):
    ctx = lifecycle_ctx
    client = request.getfixturevalue("api_key_client" if use_api else "session_client")
    url = (
        ctx.base.replace("/api/", "/api/v1/") + f"work-items/{ctx.issue.id}/"
        if use_api
        else ctx.base + f"issues/{ctx.issue.id}/"
    )
    response = client.patch(
        url, {"archived_at": timezone.now().date().isoformat(), "deleted_at": timezone.now().isoformat()}, format="json"
    )
    assert response.status_code in (200, 204), response.data
    ctx.issue.refresh_from_db()
    ctx.pending.refresh_from_db()
    assert ctx.issue.archived_at is None
    assert ctx.issue.deleted_at is None
    assert ctx.pending.status == "pending"


def test_draft_patch_cannot_soft_delete_via_ordinary_fields(lifecycle_ctx):
    from plane.app.serializers.draft import DraftIssueCreateSerializer
    from plane.db.models import DraftIssue

    ctx = lifecycle_ctx
    draft = DraftIssue.objects.create(workspace=ctx.workspace, project=ctx.project, name="Protected draft")
    serializer = DraftIssueCreateSerializer(
        draft,
        data={"deleted_at": timezone.now().isoformat()},
        partial=True,
        context={"project_id": ctx.project.id, "cycle_id": "not_provided"},
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    draft.refresh_from_db()
    assert draft.deleted_at is None


def test_direct_orm_updates_are_outside_endpoint_lifecycle_scope(lifecycle_ctx):
    ctx = lifecycle_ctx
    ProjectMember.objects.filter(pk=ctx.project_member.pk).update(role=5)
    ctx.pending.refresh_from_db()
    assert ctx.pending.status == "pending"
