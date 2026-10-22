# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, Case, When, BooleanField, IntegerField, Value, Subquery
from django.utils import timezone
from django.db import transaction
from plane.utils.notification_preferences import sync_legacy_preferences

# Third party imports
from rest_framework import status
from rest_framework.response import Response

from plane.app.serializers import (
    NotificationSerializer,
    UserNotificationPreferenceSerializer,
)
from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueSubscriber,
    Notification,
    UserNotificationPreference,
    User,
    WorkspaceMember,
)
from plane.utils.paginator import BasePaginator
from plane.utils.order_queryset import NOTIFICATION_ORDER_BY_ALLOWLIST, sanitize_order_by
from plane.app.permissions import allow_permission, ROLE

# Module imports
from ..base import BaseAPIView, BaseViewSet


def filter_notifications(notifications, params, slug, user):
    """Apply the same receiver-scoped filters to the list and bulk read action."""

    def enabled(key):
        return str(params.get(key, "false")).lower() == "true"

    def values(key):
        return [value for value in str(params.get(key) or "").split(",") if value]

    def ids(key):
        try:
            return [UUID(value) for value in values(key)]
        except (ValueError, TypeError):
            return []

    notifications = notifications.filter(
        archived_at__isnull=not enabled("archived"),
        snoozed_till__isnull=not enabled("snoozed"),
    )
    if str(params.get("read", "")).lower() in ("true", "false"):
        notifications = notifications.filter(read_at__isnull=not enabled("read"))
    if enabled("mentioned"):
        notifications = notifications.filter(sender__icontains="mentioned")
    else:
        notifications = notifications.exclude(sender__icontains="mentioned")
    type = params.get("type") or "all"
    q_filters = Q()
    type = type.split(",")
    # Subscribed issues
    if "subscribed" in type:
        issue_ids = (
            IssueSubscriber.objects.filter(workspace__slug=slug, subscriber_id=user.id)
            .annotate(created=Exists(Issue.objects.filter(created_by=user, pk=OuterRef("issue_id"))))
            .annotate(assigned=Exists(IssueAssignee.objects.filter(issue_id=OuterRef("issue_id"), assignee=user)))
            .filter(created=False, assigned=False)
            .values_list("issue_id", flat=True)
        )
        q_filters |= Q(entity_identifier__in=issue_ids)

    # Assigned Issues
    if "assigned" in type:
        issue_ids = IssueAssignee.objects.filter(workspace__slug=slug, assignee_id=user.id).values_list(
            "issue_id", flat=True
        )
        q_filters |= Q(entity_identifier__in=issue_ids)

    # Created issues
    if "created" in type:
        if WorkspaceMember.objects.filter(workspace__slug=slug, member=user, role__lt=15, is_active=True).exists():
            notifications = notifications.none()
        else:
            issue_ids = Issue.objects.filter(workspace__slug=slug, created_by=user).values_list("pk", flat=True)
            q_filters |= Q(entity_identifier__in=issue_ids)

    notifications = notifications.filter(q_filters)
    for key, field in (("project", "project_id"), ("triggered_by", "triggered_by_id")):
        if values(key):
            notifications = notifications.filter(**{f"{field}__in": ids(key)})
    issues = Issue.objects.filter(workspace__slug=slug)
    has_issue_filter = False
    for key, field in (("priority", "priority"), ("state_group", "state__group")):
        if values(key):
            issues = issues.filter(**{f"{field}__in": values(key)})
            has_issue_filter = True
    if values("assignees"):
        issues = issues.filter(issue_assignee__assignee_id__in=ids("assignees"))
        has_issue_filter = True
    if has_issue_filter:
        notifications = notifications.filter(entity_identifier__in=issues.values("pk"))
    search = str(params.get("search") or "").strip()
    if search:
        matching_issues = Issue.objects.filter(workspace__slug=slug).filter(Q(name__icontains=search))
        notifications = notifications.filter(
            Q(title__icontains=search)
            | Q(message_stripped__icontains=search)
            | Q(entity_identifier__in=matching_issues.values("pk"))
            | Q(data__issue__name__icontains=search)
        )
    return notifications


class NotificationViewSet(BaseViewSet, BasePaginator):
    model = Notification
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                workspace__slug=self.kwargs.get("slug"),
                receiver_id=self.request.user.id,
            )
            .select_related("workspace", "project", "triggered_by", "receiver")
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        intake_issue = Issue.objects.filter(
            pk=OuterRef("entity_identifier"),
            issue_intake__status__in=[0, 2, -2],
            workspace__slug=slug,
        )
        notifications = filter_notifications(
            self.get_queryset().filter(entity_name="issue"),
            request.GET,
            slug,
            request.user,
        ).annotate(
            is_inbox_issue=Exists(intake_issue),
            is_intake_issue=Exists(intake_issue),
            is_mentioned_notification=Case(
                When(sender__icontains="mentioned", then=True),
                default=False,
                output_field=BooleanField(),
            ),
        )
        order_by = request.GET.get("order_by", "-created_at")
        if order_by == "priority":
            priority = Issue.objects.filter(pk=OuterRef("entity_identifier"), workspace__slug=slug).values("priority")[
                :1
            ]
            notifications = notifications.annotate(issue_priority=Subquery(priority)).annotate(
                notification_order=Case(
                    *[When(issue_priority=p, then=Value(i)) for i, p in enumerate(["urgent", "high", "medium", "low"])],
                    default=Value(4),
                    output_field=IntegerField(),
                )
            )
            order_by = "notification_order"
        elif order_by == "unread":
            notifications = notifications.annotate(
                notification_order=Case(
                    When(read_at__isnull=True, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            order_by = "notification_order"
        else:
            order_by = sanitize_order_by(order_by, NOTIFICATION_ORDER_BY_ALLOWLIST, "-created_at")
        notifications = notifications.order_by(order_by, "-created_at", "-id")

        # Pagination
        if request.GET.get("per_page", False) and request.GET.get("cursor", False):
            return self.paginate(
                order_by=order_by,
                request=request,
                queryset=(notifications),
                on_results=lambda notifications: NotificationSerializer(notifications, many=True).data,
            )

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        notification = Notification.objects.get(workspace__slug=slug, pk=pk, receiver=request.user)
        # Only read_at and snoozed_till can be updated
        notification_data = {"snoozed_till": request.data.get("snoozed_till", None)}
        serializer = NotificationSerializer(notification, data=notification_data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def mark_read(self, request, slug, pk):
        notification = Notification.objects.get(receiver=request.user, workspace__slug=slug, pk=pk)
        notification.read_at = timezone.now()
        notification.save()
        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def mark_unread(self, request, slug, pk):
        notification = Notification.objects.get(receiver=request.user, workspace__slug=slug, pk=pk)
        notification.read_at = None
        notification.save()
        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def archive(self, request, slug, pk):
        notification = Notification.objects.get(receiver=request.user, workspace__slug=slug, pk=pk)
        notification.archived_at = timezone.now()
        notification.save()
        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def unarchive(self, request, slug, pk):
        notification = Notification.objects.get(receiver=request.user, workspace__slug=slug, pk=pk)
        notification.archived_at = None
        notification.save()
        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UnreadNotificationEndpoint(BaseAPIView):
    use_read_replica = True

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        # Watching Issues Count
        unread_notifications_count = (
            Notification.objects.filter(
                workspace__slug=slug,
                receiver_id=request.user.id,
                read_at__isnull=True,
                archived_at__isnull=True,
                snoozed_till__isnull=True,
            )
            .exclude(sender__icontains="mentioned")
            .count()
        )

        mention_notifications_count = Notification.objects.filter(
            workspace__slug=slug,
            receiver_id=request.user.id,
            read_at__isnull=True,
            archived_at__isnull=True,
            snoozed_till__isnull=True,
            sender__icontains="mentioned",
        ).count()

        return Response(
            {
                "total_unread_notifications_count": int(unread_notifications_count),
                "mention_unread_notifications_count": int(mention_notifications_count),
            },
            status=status.HTTP_200_OK,
        )


class MarkAllReadNotificationViewSet(BaseViewSet):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def create(self, request, slug):
        notifications = filter_notifications(
            Notification.objects.filter(
                workspace__slug=slug, receiver=request.user, entity_name="issue", read_at__isnull=True
            ),
            request.data,
            slug,
            request.user,
        )
        notifications.update(read_at=timezone.now())
        return Response({"message": "Successful"}, status=status.HTTP_200_OK)


class UserNotificationPreferenceEndpoint(BaseAPIView):
    model = UserNotificationPreference
    serializer_class = UserNotificationPreferenceSerializer

    # request the object
    def get(self, request):
        user_notification_preference = UserNotificationPreference.objects.get(user=request.user)
        serializer = UserNotificationPreferenceSerializer(user_notification_preference)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # update the object
    @transaction.atomic
    def patch(self, request):
        User.objects.select_for_update().get(pk=request.user.pk)
        user_notification_preference = UserNotificationPreference.objects.get(user=request.user)
        serializer = UserNotificationPreferenceSerializer(user_notification_preference, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            sync_legacy_preferences(request.user, serializer.validated_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
