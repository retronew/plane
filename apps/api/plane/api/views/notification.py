# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema

# Module imports
from plane.api.serializers import NotificationAPISerializer
from plane.api.views.base import BaseAPIView
from plane.app.permissions import WorkspaceUserPermission
from plane.db.models import Issue, IssueAssignee, IssueSubscriber, Notification
from plane.utils.openapi import WORKSPACE_SLUG_PARAMETER, create_paginated_response


NOTIFICATION_ID_PARAMETER = OpenApiParameter(
    name="notification_id", required=True, type=OpenApiTypes.UUID, location=OpenApiParameter.PATH
)


def notification_docs(**kwargs):
    parameters = [WORKSPACE_SLUG_PARAMETER, *kwargs.pop("parameters", [])]
    return extend_schema(tags=["Notifications"], parameters=parameters, **kwargs)


class NotificationMixin:
    # Any active workspace member, guests included, manages their own notifications
    permission_classes = [WorkspaceUserPermission]

    def own_notifications(self, slug):
        return Notification.objects.filter(workspace__slug=slug, receiver=self.request.user)

    def get_notification(self, slug, notification_id):
        return self.own_notifications(slug).filter(pk=notification_id).first()


class NotificationListAPIEndpoint(NotificationMixin, BaseAPIView):
    use_read_replica = True

    @notification_docs(
        operation_id="list_notifications",
        summary="List my notifications",
        description=(
            "List the requesting user's notifications, newest first. Snoozed notifications are hidden until "
            "their snooze ends; archived ones only show with `archived=true`."
        ),
        parameters=[
            OpenApiParameter(name="read", type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="archived", type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="mentioned", type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY),
            OpenApiParameter(
                name="type",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Comma-separated: assigned, created, subscribed",
            ),
        ],
        responses={200: create_paginated_response(NotificationAPISerializer, "PaginatedNotificationResponse")},
    )
    def get(self, request, slug):
        now = timezone.now()
        notifications = (
            self.own_notifications(slug)
            .filter(Q(snoozed_till__isnull=True) | Q(snoozed_till__lte=now))
            .select_related("triggered_by")
        )

        archived = request.GET.get("archived", "false").lower() == "true"
        notifications = notifications.filter(archived_at__isnull=not archived)

        read = request.GET.get("read")
        if read is not None:
            notifications = notifications.filter(read_at__isnull=read.lower() != "true")

        mentioned = request.GET.get("mentioned")
        if mentioned is not None:
            mention_q = Q(sender__icontains="mentioned")
            notifications = (
                notifications.filter(mention_q) if mentioned.lower() == "true" else notifications.exclude(mention_q)
            )

        types = {t.strip() for t in request.GET.get("type", "").split(",") if t.strip()}
        if types:
            type_q = Q()
            if "assigned" in types:
                type_q |= Q(
                    entity_identifier__in=IssueAssignee.objects.filter(
                        workspace__slug=slug, assignee=request.user
                    ).values("issue_id")
                )
            if "created" in types:
                type_q |= Q(
                    entity_identifier__in=Issue.objects.filter(workspace__slug=slug, created_by=request.user).values(
                        "id"
                    )
                )
            if "subscribed" in types:
                type_q |= Q(
                    entity_identifier__in=IssueSubscriber.objects.filter(
                        workspace__slug=slug, subscriber=request.user
                    ).values("issue_id")
                )
            notifications = notifications.filter(type_q)

        return self.paginate(
            request=request,
            queryset=notifications.order_by("-created_at", "id"),
            on_results=lambda items: NotificationAPISerializer(items, many=True).data,
        )


class NotificationUnreadCountAPIEndpoint(NotificationMixin, BaseAPIView):
    use_read_replica = True

    @notification_docs(
        operation_id="get_unread_notification_count",
        summary="Count my unread notifications",
        responses={200: OpenApiResponse(description="Unread counts, total and mentions")},
    )
    def get(self, request, slug):
        now = timezone.now()
        unread = self.own_notifications(slug).filter(
            Q(snoozed_till__isnull=True) | Q(snoozed_till__lte=now), read_at__isnull=True, archived_at__isnull=True
        )
        return Response(
            {
                "unread": unread.count(),
                "unread_mentions": unread.filter(sender__icontains="mentioned").count(),
            }
        )


class NotificationReadAPIEndpoint(NotificationMixin, BaseAPIView):
    def _set(self, slug, notification_id, read_at):
        notification = self.get_notification(slug, notification_id)
        if notification is None:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
        notification.read_at = read_at
        notification.save(update_fields=["read_at", "updated_at"])
        return Response(NotificationAPISerializer(notification).data)

    @notification_docs(
        operation_id="mark_notification_read",
        summary="Mark a notification as read",
        parameters=[NOTIFICATION_ID_PARAMETER],
        request=None,
        responses={200: NotificationAPISerializer},
    )
    def post(self, request, slug, notification_id):
        return self._set(slug, notification_id, timezone.now())

    @notification_docs(
        operation_id="mark_notification_unread",
        summary="Mark a notification as unread",
        parameters=[NOTIFICATION_ID_PARAMETER],
        responses={200: NotificationAPISerializer},
    )
    def delete(self, request, slug, notification_id):
        return self._set(slug, notification_id, None)


class NotificationArchiveAPIEndpoint(NotificationMixin, BaseAPIView):
    def _set(self, slug, notification_id, archived_at):
        notification = self.get_notification(slug, notification_id)
        if notification is None:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
        notification.archived_at = archived_at
        notification.save(update_fields=["archived_at", "updated_at"])
        return Response(NotificationAPISerializer(notification).data)

    @notification_docs(
        operation_id="archive_notification",
        summary="Archive a notification",
        parameters=[NOTIFICATION_ID_PARAMETER],
        request=None,
        responses={200: NotificationAPISerializer},
    )
    def post(self, request, slug, notification_id):
        return self._set(slug, notification_id, timezone.now())

    @notification_docs(
        operation_id="unarchive_notification",
        summary="Unarchive a notification",
        parameters=[NOTIFICATION_ID_PARAMETER],
        responses={200: NotificationAPISerializer},
    )
    def delete(self, request, slug, notification_id):
        return self._set(slug, notification_id, None)


class NotificationMarkAllReadAPIEndpoint(NotificationMixin, BaseAPIView):
    @notification_docs(
        operation_id="mark_all_notifications_read",
        summary="Mark all my notifications as read",
        description="Mark every unread, unarchived notification of the requesting user in this workspace as read.",
        request=None,
        responses={200: OpenApiResponse(description="Number of notifications marked as read")},
    )
    def post(self, request, slug):
        count = (
            self.own_notifications(slug)
            .filter(read_at__isnull=True, archived_at__isnull=True)
            .update(read_at=timezone.now(), updated_at=timezone.now())
        )
        return Response({"count": count})
