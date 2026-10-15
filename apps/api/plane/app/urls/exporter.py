# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import ExportIssuesEndpoint, ExportIssuesDownloadEndpoint


urlpatterns = [
    path(
        "workspaces/<str:slug>/export-issues/<uuid:pk>/download/",
        ExportIssuesDownloadEndpoint.as_view(),
        name="export-issues-download",
    ),
    path(
        "workspaces/<str:slug>/export-issues/",
        ExportIssuesEndpoint.as_view(),
        name="export-issues",
    ),
]
