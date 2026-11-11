from uuid import uuid4

import pytest
from django.test import RequestFactory
from rest_framework.exceptions import ParseError

from plane.utils.paginator import BasePaginator, Cursor, CursorResult, OffsetPaginator
from plane.utils.sync_window import SyncWindow

pytestmark = pytest.mark.unit


def test_known_changed_and_subgroup_structure():
    a, b, c = ({"id": str(uuid4()), "name": name} for name in "abc")
    window = SyncWindow({"sync_window": "1", "sync_known_ids": f"{a['id']},{b['id']}", "sync_changed_ids": b["id"]})
    result = window.project({"g": {"total_results": 7, "results": {"s": {"total_results": 3, "results": [a, b, c]}}}})
    assert result["results"]["g"]["total_results"] == 7
    assert result["results"]["g"]["results"]["s"] == {"total_results": 3, "results": [a["id"], b["id"], c["id"]]}
    assert result["entities"] == [b, c]
    assert result["reset_required"] is False


@pytest.mark.parametrize(
    "params",
    [
        {"sync_depth": "0"},
        {"sync_depth": "21"},
        {"sync_depth": "1.2"},
        {"sync_known_ids": "bad"},
        {"sync_changed_ids": ","},
        {"sync_known_ids": ",".join([str(uuid4())] * 2001)},
        {"sync_changed_ids": ",".join([str(uuid4())] * 201)},
    ],
)
def test_validation(params):
    with pytest.raises(ParseError):
        SyncWindow({"sync_window": "1", **params})


def test_member_limit_counts_repeated_members_and_never_truncates():
    entity = {"id": str(uuid4())}
    window = SyncWindow({"sync_window": "1"})
    assert window.project([entity] * 5000)["reset_required"] is False
    result = window.project(
        {
            "a": {"results": [entity] * 2500, "total_results": 2500},
            "b": {"results": [entity] * 2501, "total_results": 2501},
        }
    )
    assert result == {"results": {}, "entities": [], "reset_required": True}


class FakeQuerySet:
    def __init__(self, rows):
        self.rows = rows
        self.ordering = None

    def order_by(self, *ordering):
        self.ordering = ordering
        return self

    def __getitem__(self, key):
        return FakeQuerySet(self.rows[key])

    def values(self, *fields):
        return self

    def count(self):
        return len(self.rows)

    def __iter__(self):
        return iter(self.rows)

    def __len__(self):
        return len(self.rows)


def test_depth_keeps_page_size_and_next_page_and_serializes_first():
    rows = [{"id": str(uuid4()), "name": str(i)} for i in range(9)]
    queryset = FakeQuerySet(rows)
    paginator = OffsetPaginator(queryset, order_by="updated_at", on_results=list)
    request = RequestFactory().get("/", {"sync_window": "1", "sync_depth": "3", "per_page": "2", "cursor": "2:8:0"})
    response = BasePaginator().paginate(request, paginator=paginator)
    assert response.data["next_cursor"] == "2:3:0"
    assert response.data["total_pages"] == 5
    assert response.data["next_page_results"] is True
    assert response.data["sync_window"]["results"] == [r["id"] for r in rows[:6]]
    assert response.data["sync_window"]["entities"] == rows[:6]
    assert "results" not in response.data
    assert queryset.ordering[-1] == "id"


def test_ordinary_response_unchanged():
    class Stub:
        def get_result(self, limit, cursor):
            return CursorResult(
                [{"id": "ordinary"}], Cursor(limit, 1, False, False), Cursor(limit, -1, True, False), 1, 1
            )

    response = BasePaginator().paginate(RequestFactory().get("/"), paginator=Stub())
    assert response.data["results"] == [{"id": "ordinary"}]
    assert "sync_window" not in response.data


def test_changed_mode_omits_unknown_entities():
    a, b = ({"id": str(uuid4())} for _ in range(2))
    window = SyncWindow({"sync_window": "1", "sync_entity_mode": "changed", "sync_changed_ids": b["id"]})
    assert window.project([a, b]) == {
        "results": [a["id"], b["id"]],
        "entities": [b],
        "reset_required": False,
    }


@pytest.mark.django_db
@pytest.mark.parametrize("subgroup", [False, True])
def test_database_grouped_depth_and_tied_order(workspace, subgroup):
    from django.db.models import Q
    from django.utils import timezone
    from plane.db.models import Issue, Project
    from plane.utils.paginator import GroupedOffsetPaginator, SubGroupedOffsetPaginator

    project = Project.objects.create(workspace=workspace, name="Window", identifier="WIN")
    rows = []
    for priority in ["high", "low"]:
        for i in range(5):
            rows.append(Issue.objects.create(project=project, workspace=workspace, name=str(i), priority=priority))
    # Both the requested ordering and its created_at secondary key are tied.
    Issue.objects.filter(pk__in=[row.pk for row in rows]).update(created_at=timezone.now(), sort_order=1)
    kwargs = {
        "queryset": Issue.objects.filter(project=project),
        "order_by": "sort_order",
        "group_by_field_name": "priority",
        "group_by_fields": ["high", "low"],
        "count_filter": Q(),
    }
    if subgroup:
        kwargs.update(sub_group_by_field_name="project_id", sub_group_by_fields=[project.pk])
    paginator = (SubGroupedOffsetPaginator if subgroup else GroupedOffsetPaginator)(**kwargs)
    request = RequestFactory().get("/", {"sync_window": "1", "sync_depth": "2", "per_page": "2"})
    response = (
        BasePaginator()
        .paginate(
            request,
            paginator=paginator,
            group_by_field_name="priority",
            sub_group_by_field_name="project_id" if subgroup else None,
            on_results=lambda qs: list(qs.values("id", "priority", "project_id", "name")),
        )
        .data
    )
    assert response["next_cursor"] == "2:2:0"
    assert response["next_page_results"] is True
    for priority in ["high", "low"]:
        group = response["sync_window"]["results"][priority]
        assert group["total_results"] == 5
        if subgroup:
            group = group["results"][str(project.pk)]
        expected = sorted(str(row.pk) for row in rows if row.priority == priority)[:4]
        assert group["results"] == expected
    # A regular continuation uses the original page size and returns the fifth row.
    continuation = paginator.get_result(limit=2, cursor=Cursor(2, 2, False))
    assert len(continuation.results) == 2


def test_v2_rejects_sync_window_before_querying():
    from plane.app.views.issue.base import IssuePaginatedViewSet

    request = RequestFactory().get("/", {"sync_window": "1"})
    # Permission remains on the endpoint; exercise the body after authorization.
    response = IssuePaginatedViewSet.list.__wrapped__(IssuePaginatedViewSet(), request, "workspace", uuid4())
    assert response.status_code == 400
    assert "not supported" in response.data["error"]


def test_oversized_window_skips_serialization_and_bounds_materialization():
    from unittest.mock import Mock

    rows = [{"id": str(uuid4())} for _ in range(10000)]
    serializer = Mock(side_effect=AssertionError("oversized window must not serialize"))
    paginator = OffsetPaginator(FakeQuerySet(rows), order_by="updated_at", on_results=serializer)
    request = RequestFactory().get("/", {"sync_window": "1", "sync_depth": "20", "per_page": "1000"})
    response = BasePaginator().paginate(request, paginator=paginator, on_results=serializer).data
    serializer.assert_not_called()
    assert response["sync_window"] == {"results": [], "entities": [], "reset_required": True}
    assert response["count"] == 5001
