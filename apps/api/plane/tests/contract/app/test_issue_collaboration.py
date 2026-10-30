import base64
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient

from plane.db.models import Issue, IssueDescriptionDocument, IssueDescriptionVersion, Project, ProjectMember, State

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def collab(workspace, create_user, settings, monkeypatch):
    from plane.app.views.issue import collaboration

    settings.LIVE_SERVER_SECRET_KEY = "test-live-service-key"
    monkeypatch.setattr(collaboration.issue_activity, "delay", Mock())
    monkeypatch.setattr(collaboration.model_activity, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Collaboration", identifier="COLLAB")
    member = ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    issue = Issue.objects.create(project=project, state=state, name="Shared", description_html="<p>Original</p>")
    url = f"/api/workspaces/{workspace.slug}/projects/{project.pk}/issues/{issue.pk}/collaboration/"
    return SimpleNamespace(project=project, member=member, issue=issue, url=url)


def initialize(client, collab):
    current = client.get(collab.url).data
    payload = {key: current[key] for key in ["format", "epoch", "revision", "source_hash"]}
    payload["state"] = base64.b64encode(b"\x00\x00").decode()
    response = client.post(collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key")
    assert response.status_code == 200, response.data
    return response.data


def save(client, collab, current, html="<p>Changed</p>"):
    payload = {key: current[key] for key in ["format", "epoch", "revision", "state"]}
    payload["description_html"] = html
    return client.patch(collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key")


def test_initialization_once_and_cas_projection(session_client, collab, django_capture_on_commit_callbacks):
    current = initialize(session_client, collab)
    assert current["revision"] == 1
    assert IssueDescriptionVersion.objects.filter(issue=collab.issue).count() == 0
    with django_capture_on_commit_callbacks(execute=True):
        response = save(session_client, collab, current)
    assert response.status_code == 200, response.data
    assert response.data["revision"] == 2
    collab.issue.refresh_from_db()
    assert collab.issue.description_html == "<p>Changed</p>"
    assert collab.issue.description_binary is None
    assert IssueDescriptionVersion.objects.get(issue=collab.issue).description_html == "<p>Changed</p>"
    assert save(session_client, collab, current).status_code == 409
    from plane.app.views.issue import collaboration

    collaboration.issue_activity.delay.assert_called_once()
    collaboration.model_activity.delay.assert_called_once()


def test_external_model_save_invalidates_old_epoch(session_client, collab):
    current = initialize(session_client, collab)
    collab.issue.description_html = "<p>External replacement</p>"
    collab.issue.save()
    document = IssueDescriptionDocument.objects.get(issue=collab.issue)
    assert document.epoch == 1
    assert document.state is None
    assert save(session_client, collab, current).status_code == 409
    assert session_client.get(collab.url).data["description_html"] == "<p>External replacement</p>"


def test_other_field_save_does_not_reset_document(session_client, collab):
    initialize(session_client, collab)
    collab.issue.name = "Renamed"
    collab.issue.save(update_fields=["name"])
    document = IssueDescriptionDocument.objects.get(issue=collab.issue)
    assert document.epoch == 0 and document.state is not None


def test_readonly_initialization_and_server_secret_required(session_client, collab):
    collab.member.role = 5
    collab.member.save()
    from plane.db.models import WorkspaceMember

    WorkspaceMember.objects.filter(workspace=collab.project.workspace, member=collab.member.member).update(role=5)
    # Remove creator exception (fixture Issue was created outside an authenticated request).
    Issue.objects.filter(pk=collab.issue.pk).update(created_by=None)
    current = initialize(session_client, collab)
    assert current["can_edit"] is False
    assert save(session_client, collab, current).status_code == 403
    assert session_client.post(collab.url, {}, format="json").status_code == 403


def test_anonymous_nonmember_cross_project_archived_denied(session_client, collab):
    assert APIClient().get(collab.url).status_code in [401, 403]
    other = Project.objects.create(workspace=collab.project.workspace, name="Other", identifier="OTHER")
    assert session_client.get(collab.url.replace(str(collab.project.pk), str(other.pk))).status_code == 404
    collab.member.is_active = False
    collab.member.save()
    Issue.objects.filter(pk=collab.issue.pk).update(created_by=None)
    assert session_client.get(collab.url).status_code == 403
    collab.member.is_active = True
    collab.member.save()
    from django.utils import timezone

    Issue.objects.filter(pk=collab.issue.pk).update(archived_at=timezone.now().date())
    assert session_client.get(collab.url).status_code == 404


@pytest.mark.parametrize("method", ["update", "bulk_update"])
def test_queryset_description_replacement_fences(session_client, collab, method):
    current = initialize(session_client, collab)
    if method == "update":
        Issue.objects.filter(pk=collab.issue.pk).update(description_html="<p>Bulk</p>")
    else:
        collab.issue.description_html = "<p>Bulk</p>"
        Issue.objects.bulk_update([collab.issue], ["description_html"])
    document = IssueDescriptionDocument.objects.get(issue=collab.issue)
    assert document.epoch == 1 and document.state is None
    assert save(session_client, collab, current).status_code == 409


def test_http_description_replacement_fences(session_client, collab):
    current = initialize(session_client, collab)
    response = session_client.patch(
        collab.url.replace("collaboration/", ""), {"description_html": "<p>HTTP</p>"}, format="json"
    )
    assert response.status_code == 204, response.data
    assert save(session_client, collab, current).status_code == 409


def test_inactive_contributor_prevents_save(session_client, collab):
    import uuid

    current = initialize(session_client, collab)
    payload = {key: current[key] for key in ["format", "epoch", "revision", "state"]}
    payload.update(description_html="<p>Rejected</p>", contributors=[str(uuid.uuid4())])
    response = session_client.patch(
        collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
    )
    assert response.status_code == 403
    assert session_client.get(collab.url).data["revision"] == current["revision"]


def test_intake_admin_can_edit_but_noncreator_member_cannot(session_client, collab):
    from plane.db.models import Intake, IntakeIssue, WorkspaceMember

    triage = State.objects.create(project=collab.project, name="Triage", group="triage")
    collab.issue.state = triage
    collab.issue.save()
    intake = Intake.objects.create(project=collab.project, name="Inbox")
    IntakeIssue.objects.create(project=collab.project, intake=intake, issue=collab.issue)
    current = initialize(session_client, collab)
    assert save(session_client, collab, current).status_code == 200
    collab.member.role = 15
    collab.member.save()
    WorkspaceMember.objects.filter(workspace=collab.project.workspace, member=collab.member.member).update(role=15)
    Issue.objects.filter(pk=collab.issue.pk).update(created_by=None)
    assert session_client.get(collab.url).data["can_edit"] is False


def test_external_api_serializer_fences(session_client, collab):
    from plane.api.serializers.issue import IssueSerializer
    from types import SimpleNamespace

    current = initialize(session_client, collab)
    serializer = IssueSerializer(
        collab.issue,
        data={"description_html": "<p>External API</p>"},
        partial=True,
        context={"project_id": collab.project.pk, "request": SimpleNamespace(user=collab.member.member)},
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    assert save(session_client, collab, current).status_code == 409


def test_initialization_after_external_reset_uses_new_epoch(session_client, collab):
    current = initialize(session_client, collab)
    Issue.objects.filter(pk=collab.issue.pk).update(description_html="<p>Reset</p>")
    next_document = initialize(session_client, collab)
    assert next_document["epoch"] == current["epoch"] + 1
    response = save(session_client, collab, current)
    assert response.status_code == 409
    assert isinstance(response.data["epoch"], int)


@pytest.mark.django_db(transaction=True)
def test_concurrent_initialization_has_one_winner(session_client, collab):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections

    current = session_client.get(collab.url).data
    payload = {key: current[key] for key in ["format", "epoch", "revision", "source_hash"]}
    payload["state"] = "AAA="
    barrier = Barrier(2)

    def attempt():
        close_old_connections()
        client = APIClient()
        client.force_authenticate(user=collab.member.member)
        barrier.wait(timeout=10)
        try:
            return client.post(
                collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == [200, 409]
    assert IssueDescriptionDocument.objects.get(issue=collab.issue).revision == 1


def test_bad_state_and_stale_initialization_hash(session_client, collab):
    current = session_client.get(collab.url).data
    payload = {key: current[key] for key in ["format", "epoch", "revision", "source_hash"]}
    payload["state"] = "not-base64"
    assert (
        session_client.post(
            collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
        ).status_code
        == 400
    )
    payload["state"] = "AAA="
    payload["source_hash"] = "old"
    assert (
        session_client.post(
            collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
        ).status_code
        == 409
    )
