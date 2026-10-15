# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Public webhook management.

Members manage their own *personal* webhooks, which only receive events from
projects they belong to; workspace admins also manage *workspace* webhooks,
which receive every event in the workspace.
"""

# Python imports
from datetime import datetime, timezone as dt_timezone

# Django imports
from django.db import IntegrityError
from django.db.models import Q

# Third party imports
from rest_framework import serializers, status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse, OpenApiTypes, extend_schema

# Module imports
from plane.api.views.base import BaseAPIView
from plane.app.permissions import ROLE, WorkspaceUserPermission
from plane.app.serializers import WebhookSerializer
from plane.bgtasks.webhook_task import webhook_send_task
from plane.db.models import Webhook, WebhookLog, Workspace, WorkspaceMember
from plane.db.models.webhook import generate_token
from plane.utils.host import base_host
from plane.utils.openapi import WORKSPACE_SLUG_PARAMETER

from plane.utils.webhook_events import WEBHOOK_EVENTS

WEBHOOK_ID_PARAMETER = OpenApiParameter(
    name="webhook_id", required=True, type=OpenApiTypes.UUID, location=OpenApiParameter.PATH
)


class WebhookAPISerializer(WebhookSerializer):
    """The internal serializer's SSRF and domain checks, plus personal ownership and event subscriptions."""

    events = serializers.ListField(child=serializers.ChoiceField(choices=WEBHOOK_EVENTS), required=False)

    class Meta(WebhookSerializer.Meta):
        fields = [
            "id",
            "url",
            "is_active",
            "events",
            "project",
            "issue",
            "module",
            "cycle",
            "issue_comment",
            "owner",
            "secret_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "secret_key", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["scope"] = "personal" if instance.owner_id else "workspace"
        return data


def webhook_docs(**kwargs):
    parameters = [WORKSPACE_SLUG_PARAMETER, *kwargs.pop("parameters", [])]
    return extend_schema(tags=["Webhooks"], parameters=parameters, **kwargs)


class WebhookMixin:
    permission_classes = [WorkspaceUserPermission]

    def is_admin(self, slug):
        return WorkspaceMember.objects.filter(
            workspace__slug=slug, member=self.request.user, is_active=True, role=ROLE.ADMIN.value
        ).exists()

    def manageable(self, slug):
        """Webhooks the user may manage: their personal ones, plus workspace ones for admins."""
        queryset = Webhook.objects.filter(workspace__slug=slug, is_internal=False)
        mine = Q(owner=self.request.user)
        return queryset.filter(mine | Q(owner__isnull=True)) if self.is_admin(slug) else queryset.filter(mine)

    def get_webhook(self, slug, webhook_id):
        return self.manageable(slug).filter(pk=webhook_id).first()

    def not_found(self):
        return Response({"error": "Webhook not found"}, status=status.HTTP_404_NOT_FOUND)


class WebhookListCreateAPIEndpoint(WebhookMixin, BaseAPIView):
    @webhook_docs(
        operation_id="list_webhooks",
        summary="List webhooks",
        description="My personal webhooks; workspace admins also see workspace webhooks.",
        responses={200: WebhookAPISerializer(many=True)},
    )
    def get(self, request, slug):
        webhooks = self.manageable(slug).order_by("-created_at")
        return Response(WebhookAPISerializer(webhooks, many=True).data)

    @webhook_docs(
        operation_id="create_webhook",
        summary="Create a webhook",
        description=(
            "Create a personal webhook (default) that receives events from projects you are a member of, or a "
            "workspace webhook (`scope: workspace`, admins only). Subscribe with `events` (e.g. "
            "`issue.state_changed`) or the boolean toggles. The signing secret is returned only here and on "
            "regeneration."
        ),
        request=OpenApiRequest(request=WebhookAPISerializer),
        responses={201: WebhookAPISerializer},
    )
    def post(self, request, slug):
        scope = request.data.get("scope", "personal")
        if scope not in ("personal", "workspace"):
            return Response({"error": "`scope` must be personal or workspace"}, status=status.HTTP_400_BAD_REQUEST)
        if scope == "workspace" and not self.is_admin(slug):
            return Response(
                {"error": "Only workspace admins can create workspace webhooks"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = WebhookAPISerializer(data=request.data, context={"request": request, "show_secret_key": True})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        workspace = Workspace.objects.get(slug=slug)
        try:
            webhook = serializer.save(workspace_id=workspace.id, owner=request.user if scope == "personal" else None)
        except IntegrityError:
            return Response(
                {"error": "A webhook with this URL already exists in the workspace"}, status=status.HTTP_409_CONFLICT
            )
        return Response(
            WebhookAPISerializer(webhook, context={"show_secret_key": True}).data, status=status.HTTP_201_CREATED
        )


class WebhookDetailAPIEndpoint(WebhookMixin, BaseAPIView):
    @webhook_docs(
        operation_id="retrieve_webhook",
        summary="Retrieve a webhook",
        parameters=[WEBHOOK_ID_PARAMETER],
        responses={200: WebhookAPISerializer},
    )
    def get(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        return Response(WebhookAPISerializer(webhook).data) if webhook else self.not_found()

    @webhook_docs(
        operation_id="update_webhook",
        summary="Update a webhook",
        description="Change the URL, subscriptions, or pause it with `is_active: false`.",
        parameters=[WEBHOOK_ID_PARAMETER],
        request=OpenApiRequest(request=WebhookAPISerializer),
        responses={200: WebhookAPISerializer},
    )
    def patch(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        if webhook is None:
            return self.not_found()
        serializer = WebhookAPISerializer(webhook, data=request.data, partial=True, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"error": "A webhook with this URL already exists in the workspace"}, status=status.HTTP_409_CONFLICT
            )
        return Response(WebhookAPISerializer(webhook).data)

    @webhook_docs(
        operation_id="delete_webhook",
        summary="Delete a webhook",
        parameters=[WEBHOOK_ID_PARAMETER],
        responses={204: OpenApiResponse(description="Deleted")},
    )
    def delete(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        if webhook is None:
            return self.not_found()
        webhook.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebhookSecretAPIEndpoint(WebhookMixin, BaseAPIView):
    @webhook_docs(
        operation_id="regenerate_webhook_secret",
        summary="Regenerate the signing secret",
        description="The old secret stops working immediately; the new one is returned once.",
        parameters=[WEBHOOK_ID_PARAMETER],
        request=None,
        responses={200: WebhookAPISerializer},
    )
    def post(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        if webhook is None:
            return self.not_found()
        webhook.secret_key = generate_token()
        webhook.save(update_fields=["secret_key", "updated_at"])
        return Response(WebhookAPISerializer(webhook, context={"show_secret_key": True}).data)


class WebhookLogListAPIEndpoint(WebhookMixin, BaseAPIView):
    use_read_replica = True

    @webhook_docs(
        operation_id="list_webhook_logs",
        summary="List webhook deliveries",
        description="Recent deliveries with their response status, newest first.",
        parameters=[WEBHOOK_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Paginated deliveries")},
    )
    def get(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        if webhook is None:
            return self.not_found()
        logs = WebhookLog.objects.filter(webhook=webhook.id).order_by("-created_at", "id")

        def to_item(log):
            return {
                "id": str(log.id),
                "event_type": log.event_type,
                "response_status": log.response_status,
                "retry_count": log.retry_count,
                "created_at": log.created_at,
                "response_body": (log.response_body or "")[:500],
            }

        return self.paginate(request=request, queryset=logs, on_results=lambda items: [to_item(i) for i in items])


class WebhookTestAPIEndpoint(WebhookMixin, BaseAPIView):
    @webhook_docs(
        operation_id="test_webhook",
        summary="Send a test delivery",
        description="Queue a `ping` event to the webhook; check the delivery log for the result.",
        parameters=[WEBHOOK_ID_PARAMETER],
        request=None,
        responses={202: OpenApiResponse(description="Queued")},
    )
    def post(self, request, slug, webhook_id):
        webhook = self.get_webhook(slug, webhook_id)
        if webhook is None:
            return self.not_found()
        webhook_send_task.delay(
            webhook_id=str(webhook.id),
            slug=slug,
            event="ping",
            event_data={"message": "Test delivery from Plane", "sent_at": datetime.now(dt_timezone.utc).isoformat()},
            action="ping",
            current_site=base_host(request=request, is_app=True),
            activity={"actor": {"id": str(request.user.id), "display_name": request.user.display_name}},
            event_types=["ping"],
        )
        return Response({"queued": True}, status=status.HTTP_202_ACCEPTED)
