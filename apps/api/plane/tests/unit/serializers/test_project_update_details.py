# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

import pytest

from plane.app.serializers.project_overview import (
    ProjectReactionSerializer,
    ProjectUpdateCommentSerializer,
    ProjectUpdateReactionSerializer,
    ProjectUpdateSerializer,
)

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "field", ["progress", "progress_source", "comment_count", "reactions", "project", "workspace", "created_by"]
)
def test_update_snapshot_and_discussion_fields_cannot_be_supplied_by_clients(field):
    for partial in [False, True]:
        serializer = ProjectUpdateSerializer(data={"body": "Update", field: None}, partial=partial)
        assert not serializer.is_valid()
        assert field in serializer.errors


@pytest.mark.parametrize(
    "serializer_class,payload",
    [
        (ProjectUpdateCommentSerializer, {"body": "Comment"}),
        (ProjectUpdateReactionSerializer, {"reaction": "128077"}),
    ],
)
@pytest.mark.parametrize("field", ["update", "project", "workspace", "created_by", "actor", "id", "deleted_at"])
def test_discussion_ownership_and_parent_fields_are_rejected(serializer_class, payload, field):
    serializer = serializer_class(data={**payload, field: "forged"})
    assert not serializer.is_valid()
    assert field in serializer.errors


@pytest.mark.parametrize("reaction", ["👍", "128077", "👩‍💻", "1️⃣", "hello", "1114112", "👍 ", 128077, None])
def test_update_reaction_validation_matches_project_reactions(reaction):
    project = ProjectReactionSerializer(data={"reaction": reaction})
    update = ProjectUpdateReactionSerializer(data={"reaction": reaction})
    assert update.is_valid() == project.is_valid()
    assert update.errors == project.errors


@pytest.mark.parametrize(
    "progress,source",
    [(None, "current"), ({"completed": 0, "total": 0}, "snapshot"), ({"completed": 3, "total": 23}, "snapshot")],
)
def test_progress_source_and_context_fallback_preserve_snapshot(progress, source):
    instance = SimpleNamespace(progress=progress)
    current = {"completed": 4, "total": 24}
    serializer = ProjectUpdateSerializer(context={"current_progress": current})
    assert serializer.get_progress(instance) == (current if progress is None else progress)
    assert serializer.get_progress_source(instance) == source
    assert instance.progress == progress
