# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request

from plane.db.models import Issue, Project
from plane.utils.filters.filter_backend import ComplexFilterBackend
from plane.utils.filters.filterset import IssueFilterSet


@pytest.fixture
def text_issues(db, workspace, create_user):
    project = Project.objects.create(name="Text filters", identifier="TEXT", workspace=workspace)
    title = Issue.objects.create(
        project=project, workspace=workspace, name="Search Alpha", priority="high"
    )
    description = Issue.objects.create(
        project=project, workspace=workspace, name="Other title", priority="low",
        description_html='<p>Alpha 中文描述</p><a href="https://hidden.example">link</a>',
    )
    return project, title, description


def apply_filters(project, data):
    import json

    class View:
        filterset_class = IssueFilterSet

    request = Request(APIRequestFactory().get("/", {"filters": json.dumps(data)}))
    return set(ComplexFilterBackend().filter_queryset(
        request, Issue.objects.filter(project=project), View()
    ).values_list("id", flat=True))


@pytest.mark.unit
class TestIssueTextFilters:
    def test_title_is_case_insensitive_and_does_not_search_description(self, text_issues):
        project, title, _ = text_issues
        assert apply_filters(project, {"name__icontains": "aLPHa"}) == {title.id}

    def test_text_searches_title_and_plain_description(self, text_issues):
        project, title, description = text_issues
        assert apply_filters(project, {"text__icontains": "Alpha"}) == {title.id, description.id}
        assert apply_filters(project, {"text__icontains": "中文描述"}) == {description.id}
        assert apply_filters(project, {"text__icontains": "hidden.example"}) == set()

    def test_text_combines_with_other_conditions(self, text_issues):
        project, title, _ = text_issues
        assert apply_filters(project, {"and": [
            {"text__icontains": "Alpha"}, {"priority__in": "high"},
        ]}) == {title.id}
        assert apply_filters(project, {"text__icontains": "missing"}) == set()

    def test_other_lookups_remain_rejected(self, text_issues):
        project, _, _ = text_issues
        with pytest.raises(ValidationError):
            apply_filters(project, {"description_html__icontains": "Alpha"})
