# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    CycleAnalyticsAPIEndpoint,
    CycleDateCheckAPIEndpoint,
    CycleProgressAPIEndpoint,
    LabelBulkCreateAPIEndpoint,
    ModuleLinkAPIViewSet,
    ProjectIdentifierAPIEndpoint,
    ProjectLeaveAPIViewSet,
    StateDefaultAPIViewSet,
)

PROJECT = "workspaces/<str:slug>/projects/<uuid:project_id>/"

# Kwarg names match the web app views these endpoints reuse
urlpatterns = [
    path(
        f"{PROJECT}cycles/date-check/",
        CycleDateCheckAPIEndpoint.as_view(http_method_names=["post"]),
        name="cycle-date-check",
    ),
    path(
        f"{PROJECT}cycles/<uuid:cycle_id>/progress/",
        CycleProgressAPIEndpoint.as_view(http_method_names=["get"]),
        name="cycle-progress",
    ),
    path(
        f"{PROJECT}cycles/<uuid:cycle_id>/analytics/",
        CycleAnalyticsAPIEndpoint.as_view(http_method_names=["get"]),
        name="cycle-analytics",
    ),
    path(
        f"{PROJECT}modules/<uuid:module_id>/links/",
        ModuleLinkAPIViewSet.as_view({"get": "list", "post": "create"}),
        name="module-links",
    ),
    path(
        f"{PROJECT}modules/<uuid:module_id>/links/<uuid:pk>/",
        ModuleLinkAPIViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="module-link-detail",
    ),
    path(
        f"{PROJECT}states/<uuid:pk>/mark-default/",
        StateDefaultAPIViewSet.as_view({"post": "mark_as_default"}),
        name="state-mark-default",
    ),
    path(
        f"{PROJECT}members/leave/",
        ProjectLeaveAPIViewSet.as_view({"post": "leave"}),
        name="project-leave",
    ),
    path(
        f"{PROJECT}labels/bulk/",
        LabelBulkCreateAPIEndpoint.as_view(http_method_names=["post"]),
        name="labels-bulk",
    ),
    path(
        "workspaces/<str:slug>/project-identifiers/",
        ProjectIdentifierAPIEndpoint.as_view(),
        name="project-identifiers",
    ),
]
