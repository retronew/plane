# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    WebhookDetailAPIEndpoint,
    WebhookListCreateAPIEndpoint,
    WebhookLogListAPIEndpoint,
    WebhookSecretAPIEndpoint,
    WebhookTestAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/webhooks/",
        WebhookListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="webhooks",
    ),
    path(
        "workspaces/<str:slug>/webhooks/<uuid:webhook_id>/",
        WebhookDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="webhook-detail",
    ),
    path(
        "workspaces/<str:slug>/webhooks/<uuid:webhook_id>/regenerate-secret/",
        WebhookSecretAPIEndpoint.as_view(http_method_names=["post"]),
        name="webhook-regenerate-secret",
    ),
    path(
        "workspaces/<str:slug>/webhooks/<uuid:webhook_id>/logs/",
        WebhookLogListAPIEndpoint.as_view(http_method_names=["get"]),
        name="webhook-logs",
    ),
    path(
        "workspaces/<str:slug>/webhooks/<uuid:webhook_id>/test/",
        WebhookTestAPIEndpoint.as_view(http_method_names=["post"]),
        name="webhook-test",
    ),
]
