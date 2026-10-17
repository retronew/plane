# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""External project PATCH contracts backed by real project/activity rows."""

import json
from unittest import mock
from uuid import uuid4

import pytest
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from plane.db.models import Intake, Project, ProjectActivity, ProjectMember, Workspace, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Overview Project", identifier="OVERVIEW", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture(autouse=True)
def model_activity_delay():
    # Only the external Celery dispatch is mocked. Snapshotting, serializers,
    # activity creation, authentication and permission checks remain real.
    with mock.patch("plane.api.views.project.model_activity.delay") as delay:
        yield delay


def project_url(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/"


def test_patch_records_name_old_and_new_values(
    api_key_client, workspace, project, create_user, model_activity_delay, django_capture_on_commit_callbacks
):
    old_name = project.name
    payload = {"name": "Renamed Project"}

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api_key_client.patch(project_url(workspace, project), payload, format="json")
        assert response.status_code == 200, response.data
        model_activity_delay.assert_not_called()

    project.refresh_from_db()
    assert project.name == payload["name"]
    body = response.json()
    assert body["id"] == str(project.id)
    assert body["name"] == project.name
    assert body["workspace"] == str(workspace.id)
    assert body["member_role"] == 20
    assert body["is_member"] is True
    activity = ProjectActivity.objects.get(project=project)
    assert activity.workspace_id == workspace.id
    assert activity.actor_id == create_user.id
    assert activity.created_by_id == create_user.id
    assert activity.verb == "updated"
    assert activity.field == "name"
    assert activity.old_value == old_name
    assert activity.new_value == project.name
    assert len(callbacks) == 1
    model_activity_delay.assert_called_once()
    dispatch = model_activity_delay.call_args.kwargs
    assert dispatch["model_name"] == "project"
    assert dispatch["model_id"] == str(project.id)
    assert dispatch["actor_id"] == create_user.id
    assert dispatch["slug"] == workspace.slug
    assert dispatch["requested_data"] == payload
    assert json.loads(dispatch["current_instance"])["name"] == old_name


def test_patch_same_name_does_not_record_activity(api_key_client, workspace, project):
    response = api_key_client.patch(project_url(workspace, project), {"name": project.name}, format="json")

    assert response.status_code == 200, response.data
    assert response.data["name"] == project.name
    assert not ProjectActivity.objects.filter(project=project).exists()


@pytest.mark.parametrize(
    "error,expected_status,expected_body",
    [
        (
            RuntimeError("Activity storage unavailable"),
            500,
            {"error": "Something went wrong please try again later"},
        ),
        (
            ValidationError("Activity validation failed"),
            409,
            {"identifier": "The project identifier is already taken"},
        ),
        (Project.DoesNotExist("Activity project lookup failed"), 404, {"error": "Project does not exist"}),
        (Workspace.DoesNotExist("Activity workspace lookup failed"), 404, {"error": "Project does not exist"}),
        (PermissionDenied("Activity access denied"), 403, {"detail": "Activity access denied"}),
        (
            IntegrityError("Activity already exists"),
            409,
            {"name": "The project name is already taken"},
        ),
        (IntegrityError("Activity constraint failed"), 400, {"error": "The payload is not valid"}),
    ],
    ids=["runtime", "validation", "project-missing", "workspace-missing", "permission", "duplicate", "integrity"],
)
def test_activity_write_failure_rolls_back_project_intake_and_activity(
    api_key_client,
    workspace,
    project,
    model_activity_delay,
    django_capture_on_commit_callbacks,
    error,
    expected_status,
    expected_body,
):
    old_name = project.name
    old_updated_at = project.updated_at
    saved_activities = []
    original_save = ProjectActivity.save

    def save_then_fail(activity, *args, **kwargs):
        # Fail after both project and activity rows have actually been written.
        # A synthetic non-DB exception is essential: it does not mark Django's
        # transaction as broken, exposing handlers that swallow it and commit.
        assert Project.objects.get(pk=project.id).name == "Must Roll Back"
        assert Intake.objects.filter(project=project, is_default=True).exists()
        original_save(activity, *args, **kwargs)
        saved_activities.append(activity.id)
        raise error

    with (
        django_capture_on_commit_callbacks(execute=True) as callbacks,
        mock.patch.object(ProjectActivity, "save", autospec=True, side_effect=save_then_fail),
    ):
        response = api_key_client.patch(
            project_url(workspace, project),
            {"name": "Must Roll Back", "intake_view": True},
            format="json",
        )

    assert response.status_code == expected_status, response.data
    assert response.data == expected_body
    assert len(saved_activities) == 1, "The failure must occur after a real activity insert"
    project.refresh_from_db()
    assert project.name == old_name
    assert project.updated_at == old_updated_at
    assert project.intake_view is False
    assert not Intake.objects.filter(project=project).exists()
    assert not ProjectActivity.all_objects.filter(project=project).exists()
    assert callbacks == []
    model_activity_delay.assert_not_called()


@pytest.mark.parametrize(
    "payload,error_field",
    [
        ({"name": ""}, "name"),
        ({"name": "x" * 256}, "name"),
        ({"name": "Invalid@Project"}, "non_field_errors"),
        ({"name": "Must Not Save", "intake_view": "invalid"}, "intake_view"),
        ({"name": "Must Not Save", "project_lead": str(uuid4())}, "project_lead"),
    ],
    ids=["blank-name", "long-name", "special-name", "invalid-intake", "invalid-lead"],
)
def test_invalid_patch_records_no_activity(
    api_key_client, workspace, project, payload, error_field, model_activity_delay, django_capture_on_commit_callbacks
):
    old_name = project.name
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api_key_client.patch(project_url(workspace, project), payload, format="json")

    assert response.status_code == 400, response.data
    assert error_field in response.data
    project.refresh_from_db()
    assert project.name == old_name
    assert not ProjectActivity.objects.filter(project=project).exists()
    assert not Intake.objects.filter(project=project).exists()
    assert callbacks == []
    model_activity_delay.assert_not_called()


def test_unsupported_fields_keep_existing_ignore_contract(api_key_client, workspace, project):
    # These overview/read-only fields are not writable through the v1 update
    # serializer. They must not produce activity merely because they were sent.
    response = api_key_client.patch(
        project_url(workspace, project),
        {
            "priority": "high",
            "status": str(uuid4()),
            "labels": [str(uuid4())],
            "start_date": "2030-01-01",
            "target_date": "2030-01-02",
            "description_text": {"text": "Ignored"},
            "archived_at": timezone.now().isoformat(),
            "workspace": str(uuid4()),
        },
        format="json",
    )

    assert response.status_code == 200, response.data
    project.refresh_from_db()
    assert project.priority == "none"
    assert project.status_id is None
    assert not project.labels.exists()
    assert project.start_date is None
    assert project.target_date is None
    assert project.description_text is None
    assert project.archived_at is None
    assert project.workspace_id == workspace.id
    assert not ProjectActivity.objects.filter(project=project).exists()


def test_archived_project_cannot_be_changed_or_record_activity(
    api_key_client, workspace, project, model_activity_delay, django_capture_on_commit_callbacks
):
    archived_at = timezone.now()
    Project.objects.filter(pk=project.id).update(archived_at=archived_at)
    old_name = project.name

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api_key_client.patch(
            project_url(workspace, project), {"name": "Must Not Save", "intake_view": True}, format="json"
        )

    assert response.status_code == 400, response.data
    assert response.data == {"error": "Archived project cannot be updated"}
    project.refresh_from_db()
    assert project.name == old_name
    assert project.archived_at == archived_at
    assert project.intake_view is False
    assert not ProjectActivity.objects.filter(project=project).exists()
    assert not Intake.objects.filter(project=project).exists()
    assert callbacks == []
    model_activity_delay.assert_not_called()


@pytest.mark.parametrize("inconsistent_membership,expected_status", [(False, 403), (True, 404)])
def test_cross_workspace_project_cannot_be_changed_or_record_activity(
    api_key_client,
    workspace,
    project,
    create_user,
    model_activity_delay,
    django_capture_on_commit_callbacks,
    inconsistent_membership,
    expected_status,
):
    foreign_workspace = Workspace.objects.create(name="Foreign Workspace", slug="foreign-overview", owner=create_user)
    WorkspaceMember.objects.create(workspace=foreign_workspace, member=create_user, role=20)
    foreign_project = Project.objects.create(name="Foreign Project", identifier="FOREIGN", workspace=foreign_workspace)
    membership = ProjectMember.objects.create(project=foreign_project, member=create_user, role=20)
    if inconsistent_membership:
        # An inconsistent legacy membership can pass the existing permission
        # check. The endpoint must still scope its locked project lookup by slug.
        ProjectMember.objects.filter(pk=membership.id).update(workspace=workspace)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api_key_client.patch(
            project_url(workspace, foreign_project), {"name": "Must Not Save", "intake_view": True}, format="json"
        )

    assert response.status_code == expected_status, response.data
    if inconsistent_membership:
        assert response.data == {"error": "Project does not exist"}
    project.refresh_from_db()
    foreign_project.refresh_from_db()
    assert project.name == "Overview Project"
    assert foreign_project.name == "Foreign Project"
    assert foreign_project.workspace_id == foreign_workspace.id
    assert foreign_project.intake_view is False
    assert not ProjectActivity.objects.exists()
    assert not Intake.objects.filter(project=foreign_project).exists()
    assert callbacks == []
    model_activity_delay.assert_not_called()
