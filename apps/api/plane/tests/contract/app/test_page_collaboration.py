from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from plane.db.models import Page, PageDescriptionDocument, PageVersion, Project, ProjectMember, ProjectPage

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def page_collab(workspace, create_user, settings, monkeypatch):
    from plane.app.views.page import collaboration

    settings.LIVE_SERVER_SECRET_KEY = "test-live-service-key"
    monkeypatch.setattr(collaboration.page_transaction, "delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Pages", identifier="PAGES")
    member = ProjectMember.objects.create(project=project, member=create_user, role=20)
    page = Page.objects.create(
        workspace=workspace, name="Old title", owned_by=create_user, description_html="<p>Old</p>"
    )
    link = ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    url = f"/api/workspaces/{workspace.slug}/projects/{project.pk}/pages/{page.pk}/collaboration/"
    return SimpleNamespace(project=project, member=member, page=page, link=link, url=url)


def initialize(client, fixture):
    current = client.get(fixture.url).data
    payload = {key: current[key] for key in ["format", "epoch", "revision", "source_hash"]}
    payload["state"] = "AAA="
    response = client.post(fixture.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key")
    assert response.status_code == 200, response.data
    return response.data


def save(client, fixture, snapshot):
    payload = {key: snapshot[key] for key in ["format", "epoch", "revision", "state"]}
    payload.update(name="Shared title", description_html="<p>Shared content</p>")
    return client.patch(fixture.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key")


def test_title_body_snapshot_preserves_legacy_and_tasks(
    session_client, page_collab, django_capture_on_commit_callbacks
):
    current = initialize(session_client, page_collab)
    with django_capture_on_commit_callbacks(execute=True):
        response = save(session_client, page_collab, current)
    assert response.status_code == 200, response.data
    page_collab.page.refresh_from_db()
    assert page_collab.page.name == "Shared title"
    assert page_collab.page.description_html == "<p>Shared content</p>"
    assert page_collab.page.description_binary is None
    assert PageVersion.objects.get(page=page_collab.page).description_html == "<p>Shared content</p>"
    from plane.app.views.page import collaboration

    collaboration.page_transaction.delay.assert_called_once()
    assert save(session_client, page_collab, current).status_code == 409


def test_same_page_multiple_projects_shares_document(session_client, page_collab):
    current = initialize(session_client, page_collab)
    other = Project.objects.create(workspace=page_collab.project.workspace, name="Second", identifier="SECOND")
    ProjectMember.objects.create(project=other, member=page_collab.member.member, role=15)
    ProjectPage.objects.create(workspace=page_collab.project.workspace, project=other, page=page_collab.page)
    url = page_collab.url.replace(str(page_collab.project.pk), str(other.pk))
    assert session_client.get(url).data["state"] == current["state"]
    assert PageDescriptionDocument.objects.filter(page=page_collab.page).count() == 1
    page_collab.link.delete()
    assert session_client.get(page_collab.url).status_code == 404
    assert session_client.get(url).status_code == 200


@pytest.mark.parametrize("field,value", [("name", "HTTP title"), ("description_html", "<p>HTTP body</p>")])
def test_external_title_or_body_resets_epoch(session_client, page_collab, field, value):
    current = initialize(session_client, page_collab)
    setattr(page_collab.page, field, value)
    page_collab.page.save(update_fields=[field])
    document = PageDescriptionDocument.objects.get(page=page_collab.page)
    assert document.epoch == 1 and document.state is None
    assert save(session_client, page_collab, current).status_code == 409


def test_queryset_reset_and_locked_write_denial(session_client, page_collab):
    current = initialize(session_client, page_collab)
    Page.objects.filter(pk=page_collab.page.pk).update(is_locked=True)
    assert session_client.get(page_collab.url).data["can_edit"] is False
    assert save(session_client, page_collab, current).status_code == 403
    Page.objects.filter(pk=page_collab.page.pk).update(is_locked=False, description_html="<p>Reset</p>")
    assert save(session_client, page_collab, current).status_code == 409


def test_guest_public_readonly_private_owner_and_missing_link(session_client, page_collab, create_user):
    from plane.db.models import User

    owner = User.objects.create(email="other-owner@example.com", username="other-owner")
    Page.objects.filter(pk=page_collab.page.pk).update(owned_by=owner)
    page_collab.member.role = 5
    page_collab.member.save()
    current = initialize(session_client, page_collab)
    assert current["can_edit"] is False
    assert save(session_client, page_collab, current).status_code == 403
    Page.objects.filter(pk=page_collab.page.pk).update(access=Page.PRIVATE_ACCESS)
    assert session_client.get(page_collab.url).status_code == 403
    Page.objects.filter(pk=page_collab.page.pk).update(owned_by=create_user)
    assert session_client.get(page_collab.url).data["can_edit"] is True


def test_contributors_from_other_active_project_are_allowed(session_client, page_collab):
    from plane.db.models import User

    contributor = User.objects.create(email="contributor@example.com", username="contributor")
    other = Project.objects.create(workspace=page_collab.project.workspace, name="Shared", identifier="SHARED")
    ProjectMember.objects.create(project=other, member=contributor, role=15)
    link = ProjectPage.objects.create(workspace=page_collab.project.workspace, project=other, page=page_collab.page)
    current = initialize(session_client, page_collab)
    payload = {key: current[key] for key in ["format", "epoch", "revision", "state"]}
    payload.update(name="Shared", description_html="<p>Shared</p>", contributors=[str(contributor.pk)])
    response = session_client.patch(
        page_collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
    )
    assert response.status_code == 200, response.data
    payload["revision"] = response.data["revision"]
    link.delete()
    assert (
        session_client.patch(
            page_collab.url, payload, format="json", HTTP_LIVE_SERVER_SECRET_KEY="test-live-service-key"
        ).status_code
        == 403
    )
