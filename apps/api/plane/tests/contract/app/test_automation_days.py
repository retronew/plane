from datetime import timedelta
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from django.apps import apps
from django.db import connection
from django.utils import timezone

from plane.bgtasks import issue_automation_task as tasks
from plane.db.models import Issue, Project, ProjectMember, State

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def context(workspace, create_user, monkeypatch):
    project = Project.objects.create(workspace=workspace, name="Day automation", identifier="DAYS")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    started = State.objects.create(workspace=workspace, project=project, name="In progress", group="started")
    done = State.objects.create(workspace=workspace, project=project, name="Done", group="completed")
    cancelled = State.objects.create(workspace=workspace, project=project, name="Cancelled", group="cancelled")
    monkeypatch.setattr(tasks.issue_activity, "delay", Mock())
    return workspace, project, started, done, cancelled


def test_api_accepts_days_and_rejects_invalid_values(session_client, context):
    workspace, project, *_ = context
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
    for value in [1, 30, 365, 0]:
        response = session_client.patch(url, {"archive_in": value, "close_in": value}, format="json")
        assert response.status_code == 200, response.data
    for value in [-1, 366, 1.5]:
        assert session_client.patch(url, {"archive_in": value, "close_in": value}, format="json").status_code == 400


def test_archiving_uses_exact_days_instead_of_months(context):
    workspace, project, _, done, _ = context
    Project.objects.filter(pk=project.pk).update(archive_in=7)
    issue = Issue.objects.create(workspace=workspace, project=project, state=done, name="Old completed work")
    Issue.objects.filter(pk=issue.pk).update(updated_at=timezone.now() - timedelta(days=8))
    tasks.archive_old_issues()
    issue.refresh_from_db()
    assert issue.archived_at is not None


def test_closing_uses_days_and_a_state_from_the_same_project(context):
    workspace, project, started, _, cancelled = context
    Project.objects.filter(pk=project.pk).update(close_in=7)
    issue = Issue.objects.create(workspace=workspace, project=project, state=started, name="Old open work")
    Issue.objects.filter(pk=issue.pk).update(updated_at=timezone.now() - timedelta(days=8))
    tasks.close_old_issues()
    issue.refresh_from_db()
    assert issue.state_id == cancelled.id


def test_month_configuration_migration_preserves_the_effective_duration(context):
    project = context[1]
    Project.objects.filter(pk=project.pk).update(archive_in=2, close_in=3)
    migration = import_module("plane.db.migrations.0138_automation_periods_in_days")
    editor = SimpleNamespace(connection=connection)
    migration.months_to_days(apps, editor)
    project.refresh_from_db()
    assert (project.archive_in, project.close_in) == (60, 90)
    migration.days_to_months(apps, editor)
    project.refresh_from_db()
    assert (project.archive_in, project.close_in) == (2, 3)


def test_closed_state_must_be_a_cancelled_state_from_the_project(session_client, context):
    workspace, project, started, _, cancelled = context
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
    assert session_client.patch(url, {"default_state": str(cancelled.id)}, format="json").status_code == 200
    assert session_client.patch(url, {"default_state": str(started.id)}, format="json").status_code == 400
    other = Project.objects.create(workspace=workspace, name="Other automation", identifier="OTHER")
    foreign = State.objects.create(workspace=workspace, project=other, name="Cancelled", group="cancelled")
    assert session_client.patch(url, {"default_state": str(foreign.id)}, format="json").status_code == 400
