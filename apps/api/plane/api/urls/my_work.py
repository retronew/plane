# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    MyActivityAPIEndpoint,
    MyWorkItemsAPIEndpoint,
    MyWorkSummaryAPIEndpoint,
    NotificationArchiveAPIEndpoint,
    NotificationListAPIEndpoint,
    NotificationMarkAllReadAPIEndpoint,
    NotificationReadAPIEndpoint,
    NotificationUnreadCountAPIEndpoint,
    WorkspaceSearchAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/notifications/",
        NotificationListAPIEndpoint.as_view(http_method_names=["get"]),
        name="notifications",
    ),
    path(
        "workspaces/<str:slug>/notifications/unread-count/",
        NotificationUnreadCountAPIEndpoint.as_view(http_method_names=["get"]),
        name="notifications-unread-count",
    ),
    path(
        "workspaces/<str:slug>/notifications/mark-all-read/",
        NotificationMarkAllReadAPIEndpoint.as_view(http_method_names=["post"]),
        name="notifications-mark-all-read",
    ),
    path(
        "workspaces/<str:slug>/notifications/<uuid:notification_id>/read/",
        NotificationReadAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="notification-read",
    ),
    path(
        "workspaces/<str:slug>/notifications/<uuid:notification_id>/archive/",
        NotificationArchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="notification-archive",
    ),
    path(
        "workspaces/<str:slug>/search/",
        WorkspaceSearchAPIEndpoint.as_view(http_method_names=["get"]),
        name="workspace-search",
    ),
    path(
        "workspaces/<str:slug>/me/work-items/",
        MyWorkItemsAPIEndpoint.as_view(http_method_names=["get"]),
        name="my-work-items",
    ),
    path(
        "workspaces/<str:slug>/me/work-items/summary/",
        MyWorkSummaryAPIEndpoint.as_view(http_method_names=["get"]),
        name="my-work-summary",
    ),
    path(
        "workspaces/<str:slug>/me/activity/",
        MyActivityAPIEndpoint.as_view(http_method_names=["get"]),
        name="my-activity",
    ),
]
