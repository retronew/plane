from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock

import pytest
from django.db import close_old_connections, transaction
from rest_framework.exceptions import ValidationError

from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models import Issue, Project, ProjectMember, State
from plane.services.hierarchy import apply_hierarchy, preview_hierarchy
from plane.utils.workflow import WorkflowConflict

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]


def test_opposite_parent_writes_serialize_and_cannot_form_cycle(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Concurrent hierarchy", identifier="CHR")
    state = State.objects.create(project=project, name="Backlog", group="backlog", default=True)
    first = Issue.objects.create(project=project, state=state, name="First")
    second = Issue.objects.create(project=project, state=state, name="Second")
    prepared = Barrier(2, timeout=10)

    def attach(pair):
        close_old_connections()
        try:
            issue_id, parent_id = pair
            serializer = IssueCreateSerializer(
                Issue.objects.get(pk=issue_id),
                data={"parent_id": str(parent_id)},
                partial=True,
                context={"project_id": project.pk, "workspace_id": workspace.pk, "default_assignee_id": None},
            )
            assert serializer.is_valid(), serializer.errors
            prepared.wait()
            serializer.save()
            return "saved"
        except ValidationError:
            return "rejected"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attach, [(first.pk, second.pk), (second.pk, first.pk)]))
    assert sorted(results) == ["rejected", "saved"]
    first.refresh_from_db()
    second.refresh_from_db()
    assert not (first.parent_id == second.pk and second.parent_id == first.pk)


def test_two_applies_of_one_preview_only_commit_once(workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", Mock())
    project = Project.objects.create(workspace=workspace, name="Concurrent apply", identifier="CHA")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    data = {"enabled": True, "default_level": 0, "policy_version": 0, "type_levels": []}
    preview, *_ = preview_hierarchy(project, data)
    data["token"] = preview["token"]
    prepared = Barrier(2, timeout=10)

    def apply(_):
        close_old_connections()
        try:
            prepared.wait()
            with transaction.atomic():
                locked = Project.objects.select_for_update().get(pk=project.pk)
                apply_hierarchy(locked, data, create_user)
            return "saved"
        except WorkflowConflict:
            return "stale"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(apply, range(2)))
    assert sorted(results) == ["saved", "stale"]
    project.refresh_from_db()
    assert project.hierarchy_enabled and project.workflow_version == 1
