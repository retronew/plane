# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.template.loader import render_to_string

from plane.utils.email import get_email_language, normalize_email_language, generate_plain_text_from_html


pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "value, expected",
    [
        ("zh", "zh-CN"),
        (" ZH_cn ", "zh-CN"),
        ("zh-TW", "zh-CN"),
        ("en", "en"),
        ("fr", "en"),
        (None, "en"),
        ("", "en"),
        ("zhuang", "en"),
    ],
)
def test_normalize_language(value, expected):
    assert normalize_email_language(value) == expected


def test_missing_profile_defaults_to_english():
    from plane.db.models import User

    user = User(email="missing@example.com")
    user._state.fields_cache["profile"] = None
    assert get_email_language(user) == "en"
    assert get_email_language(SimpleNamespace(profile=SimpleNamespace(language=None))) == "en"


@pytest.mark.parametrize(
    "template",
    [
        "auth/magic_signin",
        "auth/forgot_password",
        "invitations/project_invitation",
        "invitations/workspace_invitation",
        "notifications/project_addition",
        "notifications/webhook-deactivate",
        "user/user_activation",
        "user/user_deactivation",
        "user/email_updated",
        "exports/analytics",
        "notifications/issue-updates",
    ],
)
def test_templates_alternate_languages_without_worker_leakage(template):
    context = {
        "email": "person@example.com",
        "receiver": {"email": "person@example.com"},
        "code": "123456",
        "first_name": "User supplied name",
        "inviter_first_name": "User supplied name",
        "workspace_name": "User supplied workspace",
        "project_name": "User supplied project",
        "language": "zh-CN",
    }
    chinese = render_to_string(f"emails/{template}.html", context)
    english = render_to_string(f"emails/{template}.html", {**context, "language": "en"})
    chinese_again = render_to_string(f"emails/{template}.html", context)
    assert chinese == chinese_again
    assert 'lang="zh-CN"' in chinese
    assert 'lang="en"' in english
    assert chinese != english
    if template != "exports/analytics":
        assert any(word in generate_plain_text_from_html(chinese) for word in ["邮件", "邀请", "工作项"])
    assert "{%" not in chinese


def test_login_task_sends_recipient_language_and_matching_plain_text():
    from plane.bgtasks import magic_link_code_task as task

    messages = []
    with (
        patch.object(
            task, "get_email_configuration", return_value=("smtp", "", "", "25", "0", "0", "sender@example.com")
        ),
        patch.object(task, "get_connection"),
        patch.object(task, "get_email_language", side_effect=["zh-CN", "en", "zh-CN"]),
        patch.object(
            task.EmailMultiAlternatives, "send", autospec=True, side_effect=lambda message: messages.append(message)
        ),
    ):
        for email in ["zh@example.com", "en@example.com", "zh@example.com"]:
            task.magic_link(email, "unused", "123456")
    assert len(messages) == 3
    assert messages[0].subject == messages[2].subject == "你的 Plane 登录验证码是 123456"
    assert messages[1].subject == "Your Plane login code is 123456"
    for message in messages:
        assert message.body == generate_plain_text_from_html(message.alternatives[0][0])
        assert "123456" in message.body
        assert message.to[0] in message.body
    assert "如果你没有请求验证码" in messages[0].body
    assert "If you were not expecting a sign-in code" in messages[1].body


def test_email_change_resolves_language_by_user_id():
    from plane.bgtasks import user_email_update_task as task

    with (
        patch.object(
            task, "get_email_configuration", return_value=("smtp", "", "", "25", "0", "0", "sender@example.com")
        ),
        patch.object(task, "get_connection"),
        patch.object(task, "get_email_language", return_value="zh-CN") as language,
        patch.object(task.EmailMultiAlternatives, "send", return_value=1),
    ):
        task.send_email_update_magic_code("new@example.com", "123456", "user-id")
        language.assert_called_once_with(email="new@example.com", user_id="user-id")


def test_recipient_id_takes_precedence_over_email():
    from plane.db.models import User

    receiver = SimpleNamespace(profile=SimpleNamespace(language="zh_CN"))
    with patch.object(User.objects, "select_related") as query:
        query.return_value.filter.return_value.first.return_value = receiver
        assert get_email_language(email="old@example.com", user_id="id") == "zh-CN"
        query.return_value.filter.assert_called_once_with(pk="id")


def test_notification_task_renders_each_recipient_independently():
    from plane.bgtasks import email_notification_task as task

    messages = []
    issue = SimpleNamespace(
        id="issue",
        name="User content 用户内容",
        sequence_id=42,
        project=SimpleNamespace(
            identifier="APP", id="project", name="Project", workspace=SimpleNamespace(slug="workspace")
        ),
    )
    actor = SimpleNamespace(first_name="Actor", last_name="Name", avatar_url="/avatar")
    receiver = SimpleNamespace(email="recipient@example.com", profile=SimpleNamespace(language="zh_CN"))
    with (
        patch.object(task, "acquire_lock", return_value=True),
        patch.object(task, "release_lock"),
        patch.object(task, "redis_instance") as redis,
        patch.object(task, "create_payload") as payload,
        patch.object(task.User.objects, "select_related") as users,
        patch.object(task.User.objects, "get", return_value=actor),
        patch.object(task.Issue.objects, "get", return_value=issue),
        patch.object(task.EmailNotificationLog.objects, "filter"),
        patch.object(
            task, "get_email_configuration", return_value=("smtp", "", "", "25", "0", "0", "sender@example.com")
        ),
        patch.object(task, "get_connection"),
        patch.object(
            task.EmailMultiAlternatives, "send", autospec=True, side_effect=lambda message: messages.append(message)
        ),
    ):
        redis.return_value.get.return_value = b"https://plane.example.com"
        users.return_value.get.return_value = receiver
        for language in ["zh_CN", "en", None, "zh"]:
            receiver.profile.language = language
            payload.return_value = {
                "actor": {
                    "activity_time": "2026-10-23 10:00:00",
                    "priority": {"old_value": ["low"], "new_value": ["high"]},
                }
            }
            task.send_email_notification("issue", [], "recipient", ["notification"])
    assert len(messages) == 4
    for message in messages:
        assert message.subject == "APP-42 User content 用户内容"
        assert message.body == generate_plain_text_from_html(message.alternatives[0][0])
        assert "User content 用户内容" in message.body
    assert "优先级" in messages[0].body
    assert "管理邮件通知偏好" in messages[0].body
    assert "低" in messages[0].body
    assert "high" in messages[1].body
    assert messages[1].body == messages[2].body
    assert messages[0].body == messages[3].body
