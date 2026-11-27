"""Contract for work-item relation listing and query count bounds."""

from types import SimpleNamespace

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from plane.db.models import Issue, IssueRelation, Project, ProjectMember, State

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ALL_RELATION_KEYS = {
    "blocking",
    "blocked_by",
    "duplicate",
    "relates_to",
    "start_after",
    "start_before",
    "finish_after",
    "finish_before",
}


@pytest.fixture
def relation_context(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Relations", identifier="REL")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
    subject = Issue.objects.create(project=project, state=state, name="Subject")
    return SimpleNamespace(workspace=workspace, project=project, state=state, subject=subject)


def route(ctx, issue_id=None):
    return (
        f"/api/workspaces/{ctx.workspace.slug}/projects/{ctx.project.pk}/issues/{issue_id or ctx.subject.pk}/"
        "issue-relation/"
    )


def test_empty_relations_short_circuits_without_scanning_issues(relation_context, session_client):
    with CaptureQueriesContext(connection) as queries:
        response = session_client.get(route(relation_context))

    assert response.status_code == 200, response.data
    assert set(response.data.keys()) == ALL_RELATION_KEYS
    assert all(response.data[key] == [] for key in ALL_RELATION_KEYS)
    # Auth/permission + single IssueRelation lookup; never fans out into 10 Issue queries.
    assert len(queries) <= 5


def test_relations_return_all_directions_in_bounded_queries(relation_context, session_client):
    ctx = relation_context
    blocker = Issue.objects.create(project=ctx.project, state=ctx.state, name="Blocker")
    blocked = Issue.objects.create(project=ctx.project, state=ctx.state, name="Blocked")
    dup_a = Issue.objects.create(project=ctx.project, state=ctx.state, name="Dup A")
    dup_b = Issue.objects.create(project=ctx.project, state=ctx.state, name="Dup B")
    rel_a = Issue.objects.create(project=ctx.project, state=ctx.state, name="Rel A")
    rel_b = Issue.objects.create(project=ctx.project, state=ctx.state, name="Rel B")
    start_after = Issue.objects.create(project=ctx.project, state=ctx.state, name="Start After")
    start_before = Issue.objects.create(project=ctx.project, state=ctx.state, name="Start Before")
    finish_after = Issue.objects.create(project=ctx.project, state=ctx.state, name="Finish After")
    finish_before = Issue.objects.create(project=ctx.project, state=ctx.state, name="Finish Before")

    common = {"workspace": ctx.workspace, "project": ctx.project}
    IssueRelation.objects.bulk_create(
        [
            IssueRelation(issue=blocked, related_issue=ctx.subject, relation_type="blocked_by", **common),
            IssueRelation(issue=ctx.subject, related_issue=blocker, relation_type="blocked_by", **common),
            IssueRelation(issue=ctx.subject, related_issue=dup_a, relation_type="duplicate", **common),
            IssueRelation(issue=dup_b, related_issue=ctx.subject, relation_type="duplicate", **common),
            IssueRelation(issue=ctx.subject, related_issue=rel_a, relation_type="relates_to", **common),
            IssueRelation(issue=rel_b, related_issue=ctx.subject, relation_type="relates_to", **common),
            IssueRelation(issue=start_after, related_issue=ctx.subject, relation_type="start_before", **common),
            IssueRelation(issue=ctx.subject, related_issue=start_before, relation_type="start_before", **common),
            IssueRelation(issue=finish_after, related_issue=ctx.subject, relation_type="finish_before", **common),
            IssueRelation(issue=ctx.subject, related_issue=finish_before, relation_type="finish_before", **common),
        ]
    )

    with CaptureQueriesContext(connection) as queries:
        response = session_client.get(route(ctx))

    assert response.status_code == 200, response.data
    assert {str(item["id"]) for item in response.data["blocking"]} == {str(blocked.pk)}
    assert {str(item["id"]) for item in response.data["blocked_by"]} == {str(blocker.pk)}
    assert {str(item["id"]) for item in response.data["duplicate"]} == {str(dup_a.pk), str(dup_b.pk)}
    assert {str(item["id"]) for item in response.data["relates_to"]} == {str(rel_a.pk), str(rel_b.pk)}
    assert {str(item["id"]) for item in response.data["start_after"]} == {str(start_after.pk)}
    assert {str(item["id"]) for item in response.data["start_before"]} == {str(start_before.pk)}
    assert {str(item["id"]) for item in response.data["finish_after"]} == {str(finish_after.pk)}
    assert {str(item["id"]) for item in response.data["finish_before"]} == {str(finish_before.pk)}
    for key in ALL_RELATION_KEYS:
        for item in response.data[key]:
            assert item["relation_type"] == key
            assert isinstance(item["label_ids"], list)
            assert isinstance(item["assignee_ids"], list)
    # Auth/permission + 1 relation query + 1 batched Issue query.
    assert len(queries) <= 6
