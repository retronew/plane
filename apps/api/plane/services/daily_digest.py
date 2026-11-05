"""Permission-scoped personal work statistics and local calendar schedules.

Periods are half open [start, end). Missed schedules collapse to one current
period, rather than replaying one message for every day of an outage.
"""

from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from django.utils import timezone

from plane.db.models import Issue, IssueAssignee, ProjectMember, WorkspaceMember

MODULES = ("completed", "open", "overdue", "due_today", "due_soon", "newly_assigned")
CONFIG_FIELDS = (
    "enabled",
    "send_time",
    "weekdays_only",
    "channels",
    "workspace_ids",
    "project_ids",
    "modules",
    "include_details",
    "send_empty",
    "due_soon_days",
)
ITEM_LIMIT = 100


def user_zone(user):
    try:
        return ZoneInfo(user.user_timezone)
    except (ValueError, ZoneInfoNotFoundError):
        return ZoneInfo("UTC")


def config_response(config):
    return {**{key: getattr(config, key) for key in CONFIG_FIELDS}, "timezone": str(user_zone(config.user))}


def schedule_slot(config, now, *, previous=False):
    """Latest planned slot <= now, or the planned slot strictly before it.

    ZoneInfo's fold=0 selects the first occurrence on DST fall-back. A missing
    spring-forward wall time normalizes forward (02:30 becomes 03:30).
    """
    zone = user_zone(config.user)
    local = now.astimezone(zone)
    hour, minute = map(int, config.send_time.split(":"))
    date = local.date()
    for _ in range(8):
        slot = datetime(date.year, date.month, date.day, hour, minute, tzinfo=zone).astimezone(dt_timezone.utc)
        if (date.weekday() < 5 or not config.weekdays_only) and (slot < now if previous else slot <= now):
            return slot
        date -= timedelta(days=1)
    raise ValueError("No daily digest schedule slot")


def accessible_workspaces(user):
    return WorkspaceMember.objects.filter(
        member=user,
        is_active=True,
        member__is_active=True,
        member__is_bot=False,
        workspace__deleted_at__isnull=True,
    )


def accessible_projects(user):
    return ProjectMember.objects.filter(
        member=user,
        is_active=True,
        project__deleted_at__isnull=True,
        project__archived_at__isnull=True,
        workspace_id__in=accessible_workspaces(user).values("workspace_id"),
    )


def assigned_items(config):
    user = config.user
    memberships = accessible_projects(user)
    if config.workspace_ids:
        memberships = memberships.filter(workspace_id__in=config.workspace_ids)
    if config.project_ids:
        memberships = memberships.filter(project_id__in=config.project_ids)
    full = memberships.filter(Q(role__gt=5) | Q(project__guest_view_all_features=True)).values("project_id")
    restricted = memberships.filter(role=5, project__guest_view_all_features=False).values("project_id")
    return Issue.issue_objects.filter(
        Q(project_id__in=full) | Q(project_id__in=restricted, created_by=user),
        id__in=IssueAssignee.objects.filter(assignee=user).values("issue_id"),
        workspace__deleted_at__isnull=True,
    ).distinct()


def build_digest(config, period_start, period_end, *, now=None):
    """Only selected sections leave this function; counts are never inferred from details.

    Details are capped per section to keep messages bounded; count is always the
    complete count. A work item can belong to multiple selected sections.
    """
    zone = user_zone(config.user)
    # Stock sections reflect generation time, even if a 23:59 delivery crosses
    # midnight. Only completion and assignment events use the planned interval.
    today = (now or timezone.now()).astimezone(zone).date()
    assigned = assigned_items(config)
    open_items = assigned.filter(state__group__in=["backlog", "unstarted", "started"])
    queries = {
        "completed": lambda: assigned.filter(
            state__group="completed", completed_at__gte=period_start, completed_at__lt=period_end
        ),
        "open": lambda: open_items,
        "overdue": lambda: open_items.filter(target_date__lt=today),
        "due_today": lambda: open_items.filter(target_date=today),
        "due_soon": lambda: open_items.filter(
            target_date__gt=today, target_date__lte=today + timedelta(days=config.due_soon_days)
        ),
        "newly_assigned": lambda: assigned.filter(
            id__in=IssueAssignee.objects.filter(
                assignee=config.user,
                created_at__gte=period_start,
                created_at__lt=period_end,
            ).values("issue_id")
        ),
    }
    sections = []
    for key in config.modules:
        query = queries[key]()
        items = []
        count = query.count()
        if config.include_details:
            for issue in query.select_related("project", "workspace").order_by("target_date", "id")[:ITEM_LIMIT]:
                items.append(
                    {
                        "id": str(issue.id),
                        "name": issue.name,
                        "identifier": f"{issue.project.identifier}-{issue.sequence_id}",
                        "workspace_slug": issue.workspace.slug,
                        "project_id": str(issue.project_id),
                        "target_date": issue.target_date.isoformat() if issue.target_date else None,
                    }
                )
        sections.append({"key": key, "count": count, "items": items})
    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "timezone": str(zone),
        "sections": sections,
    }


def digest_is_current(digest, channel):
    config = digest.config
    return (
        config.enabled
        and config.user.is_active
        and not config.user.is_bot
        and digest.revision == config.revision
        and digest.timezone == str(user_zone(config.user))
        and digest.period_end == config.last_period_end
        and channel in config.channels
    )


def digest_for_feishu(delivery):
    """Resolve by durable event key, without ever treating a digest as an issue reminder."""
    from plane.db.models import DailyDigestDelivery

    if not delivery.event_key.startswith("daily-digest:"):
        return None
    key = delivery.event_key.removeprefix("daily-digest:")
    from uuid import UUID

    try:
        key = UUID(key)
    except (ValueError, TypeError):
        return None
    return (
        DailyDigestDelivery.objects.select_related("digest__config__user")
        .filter(
            pk=key,
            channel="feishu",
            digest__config__user_id=delivery.user_id,
        )
        .first()
    )


def feishu_digest_payload(delivery):
    from plane.utils.notification_preferences import should_notify

    row = digest_for_feishu(delivery)
    if (
        not row
        or not digest_is_current(row.digest, "feishu")
        or not should_notify(
            delivery.user_id,
            event="daily_digest",
            channel="feishu",
        )
    ):
        return None
    payload = build_digest(row.digest.config, row.digest.period_start, row.digest.period_end)
    if not row.digest.config.send_empty and not any(s["count"] for s in payload["sections"]):
        return None
    return payload
