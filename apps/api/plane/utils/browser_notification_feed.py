"""Stable, receiver-scoped notification feed, independent of mutable inbox filters."""

from uuid import UUID

from django.core import signing
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response

from plane.app.serializers import NotificationSerializer


PAGE_SIZE = 100


def browser_notification_feed(request, notifications, slug):
    mentioned = str(request.GET.get("mentioned", "false")).lower() == "true"
    salt = f"browser-notifications:{request.user.id}:{slug}:{mentioned}"
    # Keep read/archived/snoozed rows in the feed. Removing them during a page walk
    # must not shift an offset and permanently hide a different, still-unread row.
    if mentioned:
        notifications = notifications.filter(sender__icontains="mentioned")
    else:
        notifications = notifications.exclude(sender__icontains="mentioned")
    cursor = request.GET.get("cursor")
    if cursor:
        try:
            value = signing.loads(cursor, salt=salt)
            created_at = parse_datetime(value["created_at"])
            identifier = UUID(value["id"])
            if created_at is None or timezone.is_naive(created_at):
                raise ValueError("Invalid timestamp")
        except (signing.BadSignature, KeyError, ValueError, TypeError):
            return Response({"error": "Invalid notification cursor."}, status=status.HTTP_400_BAD_REQUEST)
        notifications = notifications.filter(Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=identifier))
    rows = list(notifications.order_by("-created_at", "-id")[: PAGE_SIZE + 1])
    has_more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    next_cursor = None
    if has_more:
        last = rows[-1]
        next_cursor = signing.dumps({"created_at": last.created_at.isoformat(), "id": str(last.id)}, salt=salt)
    return Response(
        {
            "results": NotificationSerializer(rows, many=True).data,
            "next_page_results": has_more,
            "next_cursor": next_cursor,
        }
    )
