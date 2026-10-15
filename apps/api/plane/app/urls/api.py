# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path
from plane.app.views import ApiTokenEndpoint
from plane.app.views.api import WorkspaceApiTokenEndpoint

urlpatterns = [
    path("workspaces/<str:slug>/api-tokens/", WorkspaceApiTokenEndpoint.as_view(), name="workspace-api-tokens"),
    path(
        "workspaces/<str:slug>/api-tokens/<uuid:pk>/",
        WorkspaceApiTokenEndpoint.as_view(),
        name="workspace-api-token-detail",
    ),
    # API Tokens
    path(
        "users/api-tokens/",
        ApiTokenEndpoint.as_view(),
        name="api-tokens",
    ),
    path(
        "users/api-tokens/<uuid:pk>/",
        ApiTokenEndpoint.as_view(),
        name="api-tokens-details",
    ),
    ## End API Tokens
]
