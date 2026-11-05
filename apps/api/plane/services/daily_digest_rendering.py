"""Small, shared rendering vocabulary for digest email and Feishu."""

from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html, get_email_language

LABELS = {
    "completed": ("本期已完成", "Completed this period"),
    "open": ("未完成", "Open"),
    "overdue": ("已逾期", "Overdue"),
    "due_today": ("今日到期", "Due today"),
    "due_soon": ("即将到期", "Due soon"),
    "newly_assigned": ("新增分配", "Newly assigned"),
}


def presentation(user, payload):
    chinese = get_email_language(user) == "zh-CN"
    index = 0 if chinese else 1
    base_url = (settings.WEB_URL or settings.APP_BASE_URL or "").rstrip("/")
    return {
        "heading": "个人每日摘要" if chinese else "Your daily digest",
        "period_start": datetime.fromisoformat(payload["period_start"])
        .astimezone(ZoneInfo(payload["timezone"]))
        .strftime("%Y-%m-%d %H:%M"),
        "period_end": datetime.fromisoformat(payload["period_end"])
        .astimezone(ZoneInfo(payload["timezone"]))
        .strftime("%Y-%m-%d %H:%M"),
        "timezone": payload["timezone"],
        "sections": [
            {
                **section,
                "label": LABELS[section["key"]][index],
                "items": [
                    {
                        **item,
                        "url": (
                            f"{base_url}/{item['workspace_slug']}/projects/{item['project_id']}/issues/{item['id']}/"
                        ),
                    }
                    for item in section["items"]
                ],
            }
            for section in payload["sections"]
        ],
    }


def send_digest_email(user, payload):
    host, username, password, port, use_tls, use_ssl, from_email = get_email_configuration()
    if not host:
        raise RuntimeError("email_not_configured")
    context = presentation(user, payload)
    html = render_to_string("emails/notifications/daily-digest.html", context)
    message = EmailMultiAlternatives(
        subject=context["heading"],
        body=generate_plain_text_from_html(html),
        from_email=from_email,
        to=[user.email],
        connection=get_connection(
            host=host,
            port=int(port),
            username=username,
            password=password,
            use_tls=use_tls == "1",
            use_ssl=use_ssl == "1",
            timeout=15,
        ),
    )
    message.attach_alternative(html, "text/html")
    if message.send() != 1:
        raise RuntimeError("email_not_accepted")


def digest_feishu_card(delivery):
    from plane.services.daily_digest import feishu_digest_payload
    from plane.utils.feishu import web_url

    payload = feishu_digest_payload(delivery)
    if payload is None:
        raise ValueError("Digest is no longer eligible")
    context = presentation(delivery.user, payload)
    # Plain text avoids interpreting user-controlled work item names as card markup.
    elements = [
        {
            "tag": "div",
            "text": {
                "tag": "plain_text",
                "content": f"{context['period_start']} – {context['period_end']} ({context['timezone']})",
            },
        }
    ]
    for section in context["sections"]:
        lines = [f"{section['label']}: {section['count']}"]
        lines.extend(f"{item['identifier']} · {item['name'][:80]}" for item in section["items"][:10])
        # Six sections of CJK text must still fit Feishu's card size limit after
        # JSON escaping. Counts remain complete even when details are shortened.
        text = "\n".join(lines)
        text = text if len(text) <= 600 else text[:599] + "…"
        elements.append({"tag": "div", "text": {"tag": "plain_text", "content": text}})
    elements.append(
        {
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": context["heading"]},
                    "url": web_url("settings/profile/notifications/", is_app=True),
                    "type": "default",
                }
            ],
        }
    )
    return {
        "config": {"wide_screen_mode": True},
        "header": {"title": {"tag": "plain_text", "content": context["heading"]}, "template": "blue"},
        "elements": elements,
    }
