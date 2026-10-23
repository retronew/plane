# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import html
import re

# Django imports
from django.utils.html import strip_tags


def generate_plain_text_from_html(html_content):
    """
    Generate clean plain text from HTML email template.
    Removes all HTML tags, CSS styles, and excessive whitespace, and decodes
    HTML character references so the text/plain part reads as literal text.

    Args:
        html_content (str): The HTML content to convert to plain text

    Returns:
        str: Clean plain text without HTML tags, styles, excessive whitespace,
            or HTML character references
    """
    # Remove style tags and their content
    html_content = re.sub(r"<style[^>]*>.*?</style>", "", html_content, flags=re.DOTALL | re.IGNORECASE)

    # Strip HTML tags, then decode character references. `strip_tags` re-emits
    # entity refs verbatim, so URLs escaped for the HTML part would otherwise
    # reach the text/plain part as `?a=1&amp;b=2` and break when pasted.
    text_content = html.unescape(strip_tags(html_content))

    # Remove excessive empty lines
    text_content = re.sub(r"\n\s*\n\s*\n+", "\n\n", text_content)

    # Ensure there's a leading and trailing whitespace
    text_content = "\n\n" + text_content.lstrip().rstrip() + "\n\n"

    return text_content


def normalize_email_language(language):
    """Only English and Simplified Chinese email copy is supported."""
    language = language.strip().lower().replace("_", "-") if isinstance(language, str) else ""
    return "zh-CN" if language == "zh" or language.startswith("zh-") else "en"


def get_email_language(user=None, *, email=None, user_id=None):
    """Resolve the recipient, never the actor or the worker's active locale."""
    if user is None:
        from plane.db.models import User

        if user_id is not None:
            user = User.objects.select_related("profile").filter(pk=user_id).first()
        elif email:
            user = User.objects.select_related("profile").filter(email__iexact=email).first()
    return normalize_email_language(getattr(getattr(user, "profile", None), "language", None))


def email_subject(key, language, **values):
    return EMAIL_SUBJECTS[normalize_email_language(language)][key].format(**values)


EMAIL_SUBJECTS = {
    "en": {
        "login": "Your Plane login code is {code}",
        "password": "Reset your Plane password",
        "workspace": "{name} invited you to {workspace} on Plane",
        "project": "{name} invited you to {project} on Plane",
        "addition": "You have been added to a Plane project",
        "verify_email": "Verify your new email address",
        "email_updated": "Your Plane email address has been updated",
        "activation": "Your Plane account is now active",
        "deactivation": "Your Plane account has been deactivated",
        "export": "Your Plane Analytics export is ready",
        "webhook": "Webhook deactivated",
        "webhook_message": "Webhook {url} has been deactivated because requests failed.",
    },
    "zh-CN": {
        "login": "你的 Plane 登录验证码是 {code}",
        "password": "重置你的 Plane 密码",
        "workspace": "{name} 邀请你加入 Plane 工作空间 {workspace}",
        "project": "{name} 邀请你加入 Plane 项目 {project}",
        "addition": "你已加入 Plane 项目",
        "verify_email": "验证你的新邮箱地址",
        "email_updated": "你的 Plane 邮箱地址已更新",
        "activation": "你的 Plane 账号已重新启用",
        "deactivation": "你的 Plane 账号已停用",
        "export": "你的 Plane 分析数据已导出",
        "webhook": "Webhook 已停用",
        "webhook_message": "Webhook {url} 因请求失败已停用。",
    },
}
