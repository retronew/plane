# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    ProjectViewListCreateAPIEndpoint,
    ProjectViewDetailAPIEndpoint,
    ProjectViewWorkItemsAPIEndpoint,
    WorkspaceViewListCreateAPIEndpoint,
    WorkspaceViewDetailAPIEndpoint,
    WorkspaceViewWorkItemsAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/views/",
        ProjectViewListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-view",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/views/<uuid:view_id>/",
        ProjectViewDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-view-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/views/<uuid:view_id>/work-items/",
        ProjectViewWorkItemsAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-view-work-items",
    ),
    path(
        "workspaces/<str:slug>/views/",
        WorkspaceViewListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-view",
    ),
    path(
        "workspaces/<str:slug>/views/<uuid:view_id>/",
        WorkspaceViewDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="workspace-view-detail",
    ),
    path(
        "workspaces/<str:slug>/views/<uuid:view_id>/work-items/",
        WorkspaceViewWorkItemsAPIEndpoint.as_view(http_method_names=["get"]),
        name="workspace-view-work-items",
    ),
]
