import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from plane.db.models import Issue, Project, State
from plane.utils.filters import ComplexFilterBackend, IssueFilterSet

pytestmark = [pytest.mark.unit, pytest.mark.django_db]
NOW = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


@pytest.fixture
def duration_items(workspace):
    project = Project.objects.create(name="Duration", identifier="DUR", workspace=workspace)
    items = {}
    for legacy in (False, True):
        for label, age in [("older", 1.50000001), ("equal", 1.5), ("newer", 1.49999999), ("zero", 0)]:
            name = f"{label}-{legacy}"
            issue = Issue.objects.create(name=name, project=project)
            entered = NOW - timedelta(days=age)
            Issue.objects.filter(pk=issue.pk).update(
                created_at=entered if legacy else NOW - timedelta(days=30),
                state_changed_at=None if legacy else entered,
            )
            items[name] = issue
    return project, items


def apply_filter(project, tree):
    request = Request(APIRequestFactory().get("/", {"filters": json.dumps(tree)}))
    return ComplexFilterBackend().filter_queryset(
        request, Issue.objects.filter(project=project), SimpleNamespace(filterset_class=IssueFilterSet)
    )


@pytest.mark.parametrize("lookup,expected", [("gt", {"older"}), ("lt", {"newer", "zero"})])
def test_strict_fractional_boundary_and_created_at_fallback(duration_items, lookup, expected):
    project, _ = duration_items
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        names = set(apply_filter(project, {f"state_duration__{lookup}": 1.5}).values_list("name", flat=True))
    assert names == {f"{name}-{legacy}" for name in expected for legacy in (False, True)}


@pytest.mark.parametrize("lookup,expected", [("gt", {"older", "equal", "newer"}), ("lt", set())])
def test_zero_is_a_real_strict_threshold(duration_items, lookup, expected):
    project, _ = duration_items
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        names = set(apply_filter(project, {f"state_duration__{lookup}": 0}).values_list("name", flat=True))
    assert names == {f"{name}-{legacy}" for name in expected for legacy in (False, True)}


def test_all_leaves_share_now_and_filter_with_q_without_annotations(duration_items):
    project, _ = duration_items
    with patch("plane.utils.filters.filter_backend.timezone.now", side_effect=[NOW]) as clock:
        # A strict > x AND < x interval must stay empty, even across separate leaves.
        queryset = apply_filter(project, {"and": [{"state_duration__gt": 1.5}, {"state_duration__lt": 1.5}]})
        assert not queryset.exists()
    clock.assert_called_once_with()
    assert queryset.query.annotations == {}


def test_reentering_same_state_resets_duration(duration_items):
    project, items = duration_items
    issue = items["older-False"]
    first = State.objects.create(project=project, workspace=project.workspace, name="First", group="started")
    second = State.objects.create(project=project, workspace=project.workspace, name="Second", group="unstarted")
    for state, instant in [(first, NOW - timedelta(days=10)), (second, NOW - timedelta(days=5)), (first, NOW)]:
        with patch("plane.db.models.issue.timezone.now", return_value=instant):
            issue.state = state
            issue.save(update_fields=["state"])
    issue.refresh_from_db()
    assert issue.state_changed_at == NOW
    with patch("plane.utils.filters.filter_backend.timezone.now", return_value=NOW):
        assert not apply_filter(project, {"state_duration__gt": 1}).filter(pk=issue.pk).exists()
