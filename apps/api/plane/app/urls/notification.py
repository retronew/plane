# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path


from plane.app.views import (
    NotificationViewSet,
    UnreadNotificationEndpoint,
    MarkAllReadNotificationViewSet,
    UserNotificationPreferenceEndpoint,
)


from plane.app.views.feishu_cards import FeishuCardCallbackEndpoint
from plane.app.views.notification.preferences import UnifiedNotificationPreferenceEndpoint
from plane.app.views.feishu import (
    FeishuBindingEndpoint,
    FeishuAuthorizeEndpoint,
    FeishuCallbackEndpoint,
    FeishuTestEndpoint,
)

urlpatterns = [
    path("integrations/feishu/cards/", FeishuCardCallbackEndpoint.as_view(), name="feishu-card-callback"),
    path(
        "users/me/notification-preferences/v2/",
        UnifiedNotificationPreferenceEndpoint.as_view(),
        name="unified-user-notification-preferences",
    ),
    path("users/me/integrations/feishu/", FeishuBindingEndpoint.as_view(), name="feishu-binding"),
    path("users/me/integrations/feishu/authorize/", FeishuAuthorizeEndpoint.as_view(), name="feishu-authorize"),
    path("users/me/integrations/feishu/callback/", FeishuCallbackEndpoint.as_view(), name="feishu-callback"),
    path("users/me/integrations/feishu/test/", FeishuTestEndpoint.as_view(), name="feishu-test"),
    path(
        "workspaces/<str:slug>/users/notifications/",
        NotificationViewSet.as_view({"get": "list"}),
        name="notifications",
    ),
    path(
        "workspaces/<str:slug>/users/notifications/<uuid:pk>/",
        NotificationViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="notifications",
    ),
    path(
        "workspaces/<str:slug>/users/notifications/<uuid:pk>/read/",
        NotificationViewSet.as_view({"post": "mark_read", "delete": "mark_unread"}),
        name="notifications",
    ),
    path(
        "workspaces/<str:slug>/users/notifications/<uuid:pk>/archive/",
        NotificationViewSet.as_view({"post": "archive", "delete": "unarchive"}),
        name="notifications",
    ),
    path(
        "workspaces/<str:slug>/users/notifications/unread/",
        UnreadNotificationEndpoint.as_view(),
        name="unread-notifications",
    ),
    path(
        "workspaces/<str:slug>/users/notifications/mark-all-read/",
        MarkAllReadNotificationViewSet.as_view({"post": "create"}),
        name="mark-all-read-notifications",
    ),
    path(
        "users/me/notification-preferences/",
        UserNotificationPreferenceEndpoint.as_view(),
        name="user-notification-preferences",
    ),
]
