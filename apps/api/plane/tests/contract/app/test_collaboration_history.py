from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Issue, IssueDescriptionVersion, Page, PageVersion, Project, State, User
from plane.services.collaboration_history import save_collaboration_history

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.mark.parametrize("page", [False, True])
def test_same_author_merges_exact_snapshot_then_new_author_or_timeout_starts_version(workspace, create_user, page):
    project = Project.objects.create(workspace=workspace, name="History", identifier="HIST")
    if page:
        instance = Page.objects.create(workspace=workspace, owned_by=create_user, name="History")
        model = PageVersion
        relation = {"page": instance}
    else:
        state = State.objects.create(project=project, name="Todo", group="unstarted", default=True)
        instance = Issue.objects.create(project=project, state=state, name="History")
        model = IssueDescriptionVersion
        relation = {"issue": instance}
    instance.description_html = "<p>First</p>"
    save_collaboration_history(instance, create_user.pk, page=page)
    first = model.objects.get(**relation)
    instance.description_html = "<p>Latest exact projection</p>"
    save_collaboration_history(instance, create_user.pk, page=page)
    assert model.objects.filter(**relation).count() == 1
    first.refresh_from_db()
    assert first.description_html == instance.description_html
    other = User.objects.create(email="history-other@example.com", username="history-other")
    save_collaboration_history(instance, other.pk, page=page)
    assert model.objects.filter(**relation).count() == 2
    latest = model.objects.filter(**relation).order_by("-last_saved_at").first()
    model.objects.filter(pk=latest.pk).update(last_saved_at=timezone.now() - timedelta(seconds=601))
    model.objects.filter(pk=first.pk).update(last_saved_at=timezone.now() - timedelta(seconds=700))
    save_collaboration_history(instance, other.pk, page=page)
    assert model.objects.filter(**relation).count() == 3


def test_page_twenty_version_limit_does_not_consume_entries_for_debounced_edits(workspace, create_user):
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="History")
    for index in range(20):
        PageVersion.objects.create(
            page=page,
            workspace=workspace,
            owned_by=create_user,
            description_html=f"<p>{index}</p>",
            last_saved_at=timezone.now() - timedelta(minutes=30 - index),
        )
    for index in range(30):
        page.description_html = f"<p>Edit {index}</p>"
        save_collaboration_history(page, create_user.pk, page=True)
    assert PageVersion.objects.filter(page=page).count() == 20
    assert PageVersion.objects.filter(page=page).order_by("-last_saved_at").first().description_html == "<p>Edit 29</p>"
