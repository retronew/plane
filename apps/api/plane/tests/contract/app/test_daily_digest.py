from datetime import datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.core import mail
from django.utils import timezone

from plane.bgtasks import daily_digest_task as tasks
from plane.db.models import (
    DailyDigest,
    DailyDigestConfig,
    DailyDigestDelivery,
    Issue,
    IssueAssignee,
    Notification,
    Profile,
    Project,
    ProjectMember,
    State,
    UserNotificationPreference,
    WorkspaceMember,
)
from plane.services.daily_digest import build_digest, feishu_digest_payload
from plane.services import daily_digest_rendering as rendering
from plane.utils.feishu import delivery_allowed
from plane.utils.notification_preferences import should_notify, update_preferences

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
NOW = datetime(2026, 11, 2, 10, 1, tzinfo=dt_timezone.utc)  # Monday 18:01 Shanghai
URL = "/api/users/me/daily-digest/"


@pytest.fixture
def context(workspace, create_user, monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    monkeypatch.setattr(tasks.send_daily_digest, "delay", Mock())
    create_user.user_timezone = "Asia/Shanghai"
    create_user.save()
    project = Project.objects.create(workspace=workspace, name="Digest", identifier="DIG")
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    state = State.objects.create(project=project, workspace=workspace, group="started", name="Started")
    issue = Issue.objects.create(
        project=project,
        workspace=workspace,
        state=state,
        name="Visible work",
        target_date=NOW.date(),
        created_by=create_user,
    )
    assignment = IssueAssignee.objects.create(project=project, workspace=workspace, issue=issue, assignee=create_user)
    config = DailyDigestConfig.objects.create(
        user=create_user,
        enabled=True,
        schedule_timezone="Asia/Shanghai",
        anchor_at=NOW - timedelta(days=4),
        last_period_end=NOW.replace(minute=0) - timedelta(days=3),
        weekdays_only=True,
    )
    return SimpleNamespace(
        user=create_user,
        workspace=workspace,
        project=project,
        state=state,
        issue=issue,
        assignment=assignment,
        config=config,
    )


def counts(payload):
    return {section["key"]: section["count"] for section in payload["sections"]}


def claim_and_row(context, channel="in_app"):
    context.config.channels = [channel]
    context.config.save()
    tasks.claim_period(context.user.pk, NOW)
    return DailyDigestDelivery.objects.get(channel=channel)


def test_default_flat_contract_and_read_only_timezone(session_client, create_user):
    create_user.user_timezone = "Asia/Shanghai"
    create_user.save()
    response = session_client.get(URL)
    assert response.status_code == 200
    assert response.data == {
        "enabled": False,
        "send_time": "18:00",
        "weekdays_only": False,
        "channels": ["in_app"],
        "workspace_ids": [],
        "project_ids": [],
        "modules": ["completed", "open", "overdue", "due_today"],
        "include_details": True,
        "send_empty": False,
        "due_soon_days": 3,
        "timezone": "Asia/Shanghai",
    }
    assert not DailyDigestConfig.objects.exists()
    assert session_client.patch(URL, {"timezone": "UTC"}, format="json").status_code == 400
    assert not DailyDigestConfig.objects.exists()


@pytest.mark.parametrize(
    "data",
    [
        {"enabled": True, "channels": []},
        {"enabled": True, "modules": []},
        {"send_time": "9:30"},
        {"send_time": "24:00"},
        {"channels": ["slack"]},
        {"modules": ["secret"]},
        {"modules": ["open", "open"]},
        {"workspace_ids": ["invalid"]},
        {"workspace_ids": [str(uuid4())]},
        {"project_ids": [str(uuid4())]},
        {"due_soon_days": 0},
        {"due_soon_days": 31},
        {"enabled": "false"},
        {"user": "other"},
    ],
)
def test_invalid_patch_is_atomic(session_client, data):
    assert session_client.patch(URL, data, format="json").status_code == 400
    assert not DailyDigestConfig.objects.exists()


def test_patch_permissions_and_idempotent_patch(session_client, context):
    response = session_client.patch(URL, {"project_ids": [str(context.project.pk)]}, format="json")
    assert response.status_code == 200
    context.config.refresh_from_db()
    revision = context.config.revision
    assert context.config.last_period_end is None
    assert session_client.patch(URL, {"project_ids": [str(context.project.pk)]}, format="json").status_code == 200
    context.config.refresh_from_db()
    assert context.config.revision == revision
    ProjectMember.objects.filter(project=context.project).update(is_active=False)
    assert session_client.patch(URL, {"project_ids": [str(context.project.pk)]}, format="json").status_code == 400


def test_preview_is_side_effect_free_and_only_selected_modules(session_client, context):
    context.config.modules = ["overdue"]
    context.config.save()
    response = session_client.post(URL + "preview/", {}, format="json")
    assert response.status_code == 200
    assert set(response.data) == {"period_start", "period_end", "timezone", "sections"}
    assert counts(response.data) == {"overdue": 0}
    assert not DailyDigest.objects.exists()
    assert not Notification.objects.exists()
    assert not tasks.send_daily_digest.delay.called


def test_period_stats_current_completed_and_new_assignments(context):
    config = context.config
    config.modules = ["completed", "newly_assigned", "open"]
    end = NOW.replace(minute=0)
    start = end - timedelta(days=3)
    State.objects.filter(pk=context.state.pk).update(group="completed")
    Issue.objects.filter(pk=context.issue.pk).update(completed_at=end - timedelta(days=1))
    IssueAssignee.objects.filter(pk=context.assignment.pk).update(created_at=start)
    assert counts(build_digest(config, start, end)) == {"completed": 1, "newly_assigned": 1, "open": 0}
    Issue.objects.filter(pk=context.issue.pk).update(completed_at=end)
    IssueAssignee.objects.filter(pk=context.assignment.pk).update(created_at=end)
    assert counts(build_digest(config, start, end)) == {"completed": 0, "newly_assigned": 0, "open": 0}
    State.objects.filter(pk=context.state.pk).update(group="started")
    assert counts(build_digest(config, start, end))["completed"] == 0


@pytest.mark.parametrize(
    "reason",
    [
        "draft",
        "archived",
        "deleted",
        "project_archived",
        "project_deleted",
        "workspace_deleted",
        "inactive_project",
        "inactive_workspace",
        "inactive_user",
        "unassigned",
        "restricted_guest",
    ],
)
def test_current_permissions_and_lifecycle_filtering(context, reason):
    if reason == "draft":
        Issue.objects.filter(pk=context.issue.pk).update(is_draft=True)
    elif reason == "archived":
        Issue.objects.filter(pk=context.issue.pk).update(archived_at=NOW.date())
    elif reason == "deleted":
        Issue.objects.filter(pk=context.issue.pk).update(deleted_at=NOW)
    elif reason == "project_archived":
        Project.objects.filter(pk=context.project.pk).update(archived_at=NOW)
    elif reason == "project_deleted":
        Project.objects.filter(pk=context.project.pk).update(deleted_at=NOW)
    elif reason == "workspace_deleted":
        type(context.workspace).objects.filter(pk=context.workspace.pk).update(deleted_at=NOW)
    elif reason == "inactive_project":
        ProjectMember.objects.filter(project=context.project).update(is_active=False)
    elif reason == "inactive_workspace":
        WorkspaceMember.objects.filter(workspace=context.workspace).update(is_active=False)
    elif reason == "inactive_user":
        type(context.user).objects.filter(pk=context.user.pk).update(is_active=False)
    elif reason == "unassigned":
        IssueAssignee.objects.filter(pk=context.assignment.pk).delete()
    elif reason == "restricted_guest":
        ProjectMember.objects.filter(project=context.project).update(role=5)
        Issue.objects.filter(pk=context.issue.pk).update(created_by=None)
    assert counts(build_digest(context.config, NOW - timedelta(days=3), NOW))["open"] == 0


def test_scope_and_details(context):
    config = context.config
    config.include_details = False
    assert build_digest(config, NOW - timedelta(days=1), NOW)["sections"][1] == {"key": "open", "count": 1, "items": []}
    config.project_ids = [str(uuid4())]
    assert counts(build_digest(config, NOW - timedelta(days=1), NOW))["open"] == 0


def test_schedule_claim_is_idempotent_and_covers_weekend(context):
    tasks.claim_period(context.user.pk, NOW)
    tasks.claim_period(context.user.pk, NOW)
    digest = DailyDigest.objects.get()
    assert digest.period_start == NOW.replace(minute=0) - timedelta(days=3)
    assert digest.period_end == NOW.replace(minute=0)
    assert DailyDigestDelivery.objects.count() == 1
    # A week of downtime collapses into a single message, preserving the interval.
    tasks.claim_period(context.user.pk, NOW + timedelta(days=7))
    assert DailyDigest.objects.count() == 2
    assert DailyDigest.objects.latest("period_end").period_start == digest.period_end


def test_timezone_change_resets_without_history(context):
    type(context.user).objects.filter(pk=context.user.pk).update(user_timezone="UTC")
    tasks.claim_period(context.user.pk, NOW)
    assert not DailyDigest.objects.exists()
    context.config.refresh_from_db()
    assert context.config.anchor_at == NOW
    assert context.config.schedule_timezone == "UTC"


def test_in_app_payload_single_digest_no_issue_and_inbox_visibility(session_client, context):
    row = claim_and_row(context)
    tasks.send_daily_digest.run(str(row.pk))
    tasks.send_daily_digest.run(str(row.pk))
    notification = Notification.objects.get()
    assert notification.project_id is None
    assert notification.entity_name == "daily_digest"
    assert notification.sender == "in_app:daily_digest"
    assert notification.data["event"] == "daily_digest"
    assert counts(notification.data["digest"])["open"] == 1
    item = notification.data["digest"]["sections"][1]["items"][0]
    assert item == {
        "id": str(context.issue.pk),
        "name": "Visible work",
        "identifier": "DIG-1",
        "workspace_slug": context.workspace.slug,
        "project_id": str(context.project.pk),
        "target_date": NOW.date().isoformat(),
    }
    response = session_client.get(f"/api/workspaces/{context.workspace.slug}/users/notifications/")
    assert response.status_code == 200
    assert any(str(value["id"]) == str(notification.pk) for value in response.data)


def test_repeat_overdue_daily_and_omitted_counts_never_leave_service(context, monkeypatch):
    Issue.objects.filter(pk=context.issue.pk).update(target_date=NOW.date() - timedelta(days=10))
    context.config.modules = ["overdue"]
    context.config.save()
    first = claim_and_row(context)
    tasks.send_daily_digest.run(str(first.pk))
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(days=1))
    tasks.claim_period(context.user.pk, NOW + timedelta(days=1))
    second = DailyDigestDelivery.objects.exclude(pk=first.pk).get()
    tasks.send_daily_digest.run(str(second.pk))
    assert Notification.objects.count() == 2
    for notification in Notification.objects.all():
        assert counts(notification.data["digest"]) == {"overdue": 1}


@pytest.mark.parametrize("reason", ["config", "permission", "global_channel"])
def test_send_time_revalidation(context, reason):
    row = claim_and_row(context)
    if reason == "config":
        DailyDigestConfig.objects.filter(pk=context.user.pk).update(enabled=False)
    elif reason == "permission":
        WorkspaceMember.objects.filter(workspace=context.workspace).update(is_active=False)
    else:
        update_preferences(context.user, None, None, {"channels": {"in_app": False}})
    tasks.send_daily_digest.run(str(row.pk))
    assert not Notification.objects.exists()


def test_independent_channels_retry_email_without_duplicating_in_app(context, monkeypatch):
    context.config.channels = ["in_app", "email"]
    context.config.save()
    tasks.claim_period(context.user.pk, NOW)
    email = DailyDigestDelivery.objects.get(channel="email")
    in_app = DailyDigestDelivery.objects.get(channel="in_app")
    sender = Mock(side_effect=RuntimeError("SMTP unavailable"))
    monkeypatch.setattr(tasks, "send_digest_email", sender)
    tasks.send_daily_digest.run(str(email.pk))
    tasks.send_daily_digest.run(str(in_app.pk))
    email.refresh_from_db()
    assert email.status == "retry"
    DailyDigestDelivery.objects.filter(pk=email.pk).update(next_attempt_at=NOW)
    sender.side_effect = None
    tasks.send_daily_digest.run(str(email.pk))
    email.refresh_from_db()
    assert email.status == "sent"
    assert Notification.objects.count() == 1


def test_empty_suppression_and_send_empty(context):
    context.config.modules = ["completed"]
    context.config.save()
    row = claim_and_row(context)
    tasks.send_daily_digest.run(str(row.pk))
    row.refresh_from_db()
    assert row.status == "skipped"
    assert not Notification.objects.exists()


def test_daily_digest_does_not_map_to_legacy_email(context):
    UserNotificationPreference.objects.update_or_create(user=context.user, defaults={"property_change": False})
    assert should_notify(context.user, event="daily_digest", channel="email")
    update_preferences(context.user, None, None, {"channels": {"email": False}})
    assert not should_notify(context.user, event="daily_digest", channel="email")


def test_feishu_eligibility_has_no_issue_or_project_reminder_dependency(context, monkeypatch):
    row = claim_and_row(context, "feishu")
    update_preferences(context.user, None, None, {"channels": {"feishu": True}})
    binding = SimpleNamespace(app_id="app")
    delivery = SimpleNamespace(
        event_key=f"daily-digest:{row.pk}",
        kind="daily_digest",
        user=context.user,
        user_id=context.user.pk,
        binding=binding,
        is_test=False,
        workspace_id=None,
    )
    assert delivery_allowed(delivery, SimpleNamespace(enabled=True, app_id="app"))
    card = rendering.digest_feishu_card(delivery)
    assert "daily digest" in card["header"]["title"]["content"]
    ProjectMember.objects.filter(project=context.project).update(is_active=False)
    assert feishu_digest_payload(delivery) is None
    assert not delivery_allowed(delivery, SimpleNamespace(enabled=True, app_id="app"))


@pytest.mark.parametrize("language,heading", [("en", "Your daily digest"), ("zh-CN", "个人每日摘要")])
def test_localized_email_uses_mock_transport_only(context, monkeypatch, language, heading):
    Profile.objects.update_or_create(user=context.user, defaults={"language": language})
    context.user.refresh_from_db()
    monkeypatch.setattr(
        rendering, "get_email_configuration", lambda: ("smtp.invalid", "", "", 25, "0", "0", "noreply@example.invalid")
    )
    monkeypatch.setattr(
        rendering,
        "get_connection",
        lambda **kwargs: mail.get_connection(backend="django.core.mail.backends.locmem.EmailBackend"),
    )
    payload = build_digest(context.config, NOW - timedelta(days=3), NOW)
    rendering.send_digest_email(context.user, payload)
    assert mail.outbox[-1].subject == heading
    assert "Visible work" in mail.outbox[-1].alternatives[0][0]


@pytest.mark.django_db(transaction=True)
def test_parallel_claims_and_in_app_delivery_are_idempotent(context):
    from concurrent.futures import ThreadPoolExecutor
    from django.db import close_old_connections

    def claim(_):
        close_old_connections()
        try:
            tasks.claim_period(context.user.pk, NOW)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(claim, range(2)))
    assert DailyDigest.objects.count() == 1
    row = DailyDigestDelivery.objects.get()

    def send(_):
        close_old_connections()
        try:
            tasks.send_daily_digest.run(str(row.pk))
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(send, range(2)))
    assert Notification.objects.count() == 1


def test_send_empty_delivers_selected_zero_sections(context):
    context.config.modules = ["completed"]
    context.config.send_empty = True
    context.config.save()
    row = claim_and_row(context)
    tasks.send_daily_digest.run(str(row.pk))
    assert counts(Notification.objects.get().data["digest"]) == {"completed": 0}


def test_email_global_switch_prevents_transport(context, monkeypatch):
    row = claim_and_row(context, "email")
    sender = Mock()
    monkeypatch.setattr(tasks, "send_digest_email", sender)
    update_preferences(context.user, None, None, {"channels": {"email": False}})
    tasks.send_daily_digest.run(str(row.pk))
    sender.assert_not_called()
    row.refresh_from_db()
    assert row.status == "cancelled"


def test_superseded_period_is_cancelled_instead_of_history_burst(context, monkeypatch):
    first = claim_and_row(context)
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(days=7))
    tasks.claim_period(context.user.pk, NOW + timedelta(days=7))
    tasks.send_daily_digest.run(str(first.pk))
    first.refresh_from_db()
    assert first.status == "cancelled"
    assert not Notification.objects.exists()


def test_feishu_large_chinese_digest_stays_bounded(context, monkeypatch):
    import json
    from plane.services import daily_digest

    item = {
        "id": str(context.issue.pk),
        "name": "长" * 255,
        "identifier": "DIG-1",
        "workspace_slug": context.workspace.slug,
        "project_id": str(context.project.pk),
        "target_date": None,
    }
    payload = {
        "period_start": NOW.isoformat(),
        "period_end": NOW.isoformat(),
        "timezone": "Asia/Shanghai",
        "sections": [{"key": key, "count": 100, "items": [item] * 100} for key in daily_digest.MODULES],
    }
    monkeypatch.setattr(daily_digest, "feishu_digest_payload", lambda delivery: payload)
    card = rendering.digest_feishu_card(SimpleNamespace(user=context.user))
    assert len(json.dumps(card).encode()) < 30000
    assert sum("100" in element.get("text", {}).get("content", "") for element in card["elements"]) == 6


def test_delayed_2359_digest_uses_generation_date_for_stock(context):
    # Planned at Nov 1 23:59 Shanghai, generated after midnight on Nov 2.
    end = datetime(2026, 11, 1, 15, 59, tzinfo=dt_timezone.utc)
    generated = end + timedelta(minutes=2)
    context.config.modules = ["open", "overdue", "due_today", "due_soon", "newly_assigned"]
    IssueAssignee.objects.filter(pk=context.assignment.pk).update(created_at=end + timedelta(seconds=30))
    payload = build_digest(context.config, end - timedelta(days=1), end, now=generated)
    assert counts(payload) == {"open": 1, "overdue": 0, "due_today": 1, "due_soon": 0, "newly_assigned": 0}
    Issue.objects.filter(pk=context.issue.pk).update(target_date=end.astimezone(tasks.user_zone(context.user)).date())
    payload = build_digest(context.config, end - timedelta(days=1), end, now=generated)
    assert counts(payload)["overdue"] == 1
    assert counts(payload)["due_today"] == 0
    assert payload["period_end"] == end.isoformat()


def test_message_period_is_localized_without_mutating_api_payload(context, monkeypatch):
    from plane.services import daily_digest

    payload = build_digest(context.config, NOW - timedelta(days=3), NOW)
    original_end = payload["period_end"]
    formatted = rendering.presentation(context.user, payload)
    assert formatted["period_end"] == "2026-11-02 18:01"
    assert formatted["sections"][0]["label"] == "Completed this period"
    assert payload["period_end"] == original_end
    monkeypatch.setattr(daily_digest, "feishu_digest_payload", lambda delivery: payload)
    card = rendering.digest_feishu_card(SimpleNamespace(user=context.user))
    assert "2026-11-02 18:01" in card["elements"][0]["text"]["content"]
    assert "Asia/Shanghai" in card["elements"][0]["text"]["content"]
