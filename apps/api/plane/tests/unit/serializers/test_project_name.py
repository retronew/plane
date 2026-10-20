# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db import IntegrityError, transaction

from plane.api.serializers.project import (
    ProjectCreateSerializer,
    ProjectSerializer as APIProjectSerializer,
    ProjectUpdateSerializer,
)
from plane.app.serializers.project import ProjectSerializer
from plane.db.models import Project

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

CREATE_SERIALIZERS = [ProjectSerializer, ProjectCreateSerializer, APIProjectSerializer]
UPDATE_SERIALIZERS = [ProjectSerializer, ProjectUpdateSerializer, APIProjectSerializer]
NAMES = ["R&D + Design: v2.0 (2026)!", "项目：研发与设计", "Launch 🚀 👩‍💻", "&+,:;$^}{*=?@#|'<>.()%!-", "项" * 255]


@pytest.mark.parametrize("serializer_class", CREATE_SERIALIZERS)
@pytest.mark.parametrize("name", NAMES)
def test_create_accepts_project_names_and_trims_whitespace(serializer_class, name, workspace):
    serializer = serializer_class(
        data={"name": f"  {name}  ", "identifier": "NAME"},
        context={"workspace_id": workspace.id},
    )
    assert serializer.is_valid(), serializer.errors
    project = serializer.save()
    project.refresh_from_db()
    assert project.name == name


@pytest.mark.parametrize("serializer_class", UPDATE_SERIALIZERS)
@pytest.mark.parametrize("name", NAMES)
def test_update_accepts_project_names_and_trims_whitespace(serializer_class, name, workspace):
    project = Project.objects.create(name="Original", identifier="NAME", workspace=workspace)
    serializer = serializer_class(
        project, data={"name": f"  {name}  "}, partial=True, context={"workspace_id": workspace.id}
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    project.refresh_from_db()
    assert project.name == name


@pytest.mark.parametrize("serializer_class", CREATE_SERIALIZERS)
@pytest.mark.parametrize("name_data", [{}, {"name": ""}, {"name": " \t\n "}, {"name": "项" * 256}])
def test_create_preserves_required_blank_and_length_rules(serializer_class, name_data, workspace):
    serializer = serializer_class(data={**name_data, "identifier": "NAME"}, context={"workspace_id": workspace.id})
    assert not serializer.is_valid()
    assert "name" in serializer.errors


@pytest.mark.parametrize("serializer_class", UPDATE_SERIALIZERS)
@pytest.mark.parametrize("name", ["", " \t\n ", "项" * 256])
def test_update_preserves_blank_and_length_rules(serializer_class, name, workspace):
    project = Project.objects.create(name="Original", identifier="NAME", workspace=workspace)
    serializer = serializer_class(project, data={"name": name}, partial=True, context={"workspace_id": workspace.id})
    assert not serializer.is_valid()
    assert "name" in serializer.errors


@pytest.mark.parametrize("serializer_class", UPDATE_SERIALIZERS)
def test_patch_without_name_preserves_existing_special_characters(serializer_class, workspace):
    project = Project.objects.create(name="R&D 🚀", identifier="NAME", workspace=workspace)
    serializer = serializer_class(
        project, data={"description": "Updated"}, partial=True, context={"workspace_id": workspace.id}
    )
    assert serializer.is_valid(), serializer.errors
    assert "name" not in serializer.validated_data
    serializer.save()
    project.refresh_from_db()
    assert project.name == "R&D 🚀"
    assert project.description == "Updated"


@pytest.mark.parametrize("serializer_class", CREATE_SERIALIZERS)
@pytest.mark.parametrize("updating", [False, True])
def test_identifier_special_character_restriction_is_preserved(serializer_class, updating, workspace):
    instance = Project.objects.create(name="Original", identifier="NAME", workspace=workspace) if updating else None
    if updating and serializer_class is ProjectCreateSerializer:
        serializer_class = ProjectUpdateSerializer
    serializer = serializer_class(
        instance,
        data={"name": "R&D 🚀", "identifier": "BAD!"},
        partial=updating,
        context={"workspace_id": workspace.id},
    )
    assert not serializer.is_valid()
    assert "identifier" in str(serializer.errors).lower()


@pytest.mark.parametrize("serializer_class", CREATE_SERIALIZERS)
@pytest.mark.parametrize("updating", [False, True])
def test_duplicate_special_character_name_remains_rejected(serializer_class, updating, workspace):
    Project.objects.create(name="R&D 🚀", identifier="TAKEN", workspace=workspace)
    instance = Project.objects.create(name="Original", identifier="NAME", workspace=workspace) if updating else None
    if updating and serializer_class is ProjectCreateSerializer:
        serializer_class = ProjectUpdateSerializer
    serializer = serializer_class(
        instance,
        data={"name": "  R&D 🚀  ", "identifier": "NAME"},
        partial=updating,
        context={"workspace_id": workspace.id},
    )
    if serializer_class is ProjectSerializer:
        assert not serializer.is_valid()
        assert serializer.errors["name"] == ["PROJECT_NAME_ALREADY_EXIST"]
    else:
        # External serializers keep relying on the database uniqueness constraint.
        assert serializer.is_valid(), serializer.errors
        with pytest.raises(IntegrityError), transaction.atomic():
            serializer.save()


@pytest.mark.parametrize("serializer_class", UPDATE_SERIALIZERS)
def test_update_can_keep_its_own_name(serializer_class, workspace):
    project = Project.objects.create(name="R&D 🚀", identifier="NAME", workspace=workspace)
    serializer = serializer_class(
        project, data={"name": project.name}, partial=True, context={"workspace_id": workspace.id}
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()
