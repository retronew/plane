from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from plane.db.models import BotTypeEnum, Issue, Project, State, User
from plane.utils.seed_data import load_seed_data
from django.conf import settings
from plane.bgtasks.workspace_seed_task import create_project_states

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def test_backfill_is_dry_run_and_never_overwrites_user_content(workspace, create_user):
    bot = User.objects.create(
        username=f"bot_user_{workspace.id}",
        email="seed@example.invalid",
        is_bot=True,
        bot_type=BotTypeEnum.WORKSPACE_SEED,
    )
    project = Project.objects.create(workspace=workspace, name="Example", identifier="EX", created_by=bot)
    state = State.objects.create(workspace=workspace, project=project, name="Todo", group="unstarted", created_by=bot)
    source = load_seed_data(settings.SEED_DIR, "issues.json", original=True)[2]
    issue = Issue.objects.create(
        workspace=workspace,
        project=project,
        state=state,
        name=source["name"],
        description_html="<p>Keep my edited description</p>",
        created_by=bot,
    )
    Issue.objects.filter(pk=issue.pk).update(sequence_id=3, created_by=bot)
    human = Issue.objects.create(
        workspace=workspace, project=project, state=state, name=source["name"], created_by=create_user
    )
    Issue.objects.filter(pk=human.pk).update(created_by=create_user)
    call_command("localize_workspace_examples", workspace=workspace.slug, stdout=StringIO())
    issue.refresh_from_db()
    assert issue.name == source["name"]
    call_command("localize_workspace_examples", workspace=workspace.slug, apply=True, stdout=StringIO())
    issue.refresh_from_db()
    human.refresh_from_db()
    assert issue.name == "2. 邀请团队成员"
    assert issue.description_html == "<p>Keep my edited description</p>"
    assert issue.state_id == state.id
    assert human.name == source["name"]
    again = StringIO()
    call_command("localize_workspace_examples", workspace=workspace.slug, apply=True, stdout=again)
    assert "Updated 0 examples" in again.getvalue()


def test_seed_states_use_workspace_owner_language(workspace, create_user):
    from plane.db.models import Profile

    Profile.objects.update_or_create(user=create_user, defaults={"language": "zh-CN"})
    project = Project.objects.create(
        workspace=workspace, name="Chinese example", identifier="ZH", created_by=create_user
    )
    with patch("plane.bgtasks.workspace_seed_task.logger"):
        states = create_project_states(workspace, {1: project.id}, create_user)
    assert set(State.objects.filter(id__in=states.values()).values_list("name", flat=True)) == {
        "待规划",
        "待处理",
        "进行中",
        "已完成",
        "已取消",
    }


def test_backfill_keeps_collaborative_page_state(workspace):
    from plane.db.models import Page

    bot = User.objects.create(
        username=f"bot_user_{workspace.id}",
        email="page-seed@example.invalid",
        is_bot=True,
        bot_type=BotTypeEnum.WORKSPACE_SEED,
    )
    source = load_seed_data(settings.SEED_DIR, "pages.json", original=True)[0]
    page = Page(
        workspace=workspace,
        owned_by=bot,
        created_by=bot,
        name=source["name"],
        description_html=source["description_html"],
        description_binary=b"existing-yjs-state",
    )
    page.save(disable_auto_set_user=True)
    call_command("localize_workspace_examples", workspace=workspace.slug, apply=True, stdout=StringIO())
    page.refresh_from_db()
    assert page.name == "项目设计说明"
    assert bytes(page.description_binary) == b"existing-yjs-state"
    assert page.description_html == source["description_html"]
