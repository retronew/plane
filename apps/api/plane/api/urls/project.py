# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    ProjectListCreateAPIEndpoint,
    ProjectListLiteAPIEndpoint,
    ProjectDetailAPIEndpoint,
    ProjectArchiveUnarchiveAPIEndpoint,
    ProjectSummaryAPIEndpoint,
)

from plane.api.views.business import (
    MemberWorkAPIEndpoint,
    MemberWorkItemsAPIEndpoint,
    ProjectActivityAPIEndpoint,
    IssueCommentReviewAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/member-work/",
        MemberWorkAPIEndpoint.as_view(http_method_names=["get"]),
        name="member-work",
    ),
    path(
        "workspaces/<str:slug>/member-work/<uuid:user_id>/items/",
        MemberWorkItemsAPIEndpoint.as_view(http_method_names=["get"]),
        name="member-work-items",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/activities/",
        ProjectActivityAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-activities",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comment-reviews/",
        IssueCommentReviewAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-comment-reviews",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comments/<uuid:comment_id>/review/",
        IssueCommentReviewAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-comment-review",
    ),
    path(
        "workspaces/<str:slug>/projects/",
        ProjectListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project",
    ),
    path(
        "workspaces/<str:slug>/projects-lite/",
        ProjectListLiteAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-lite",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:pk>/",
        ProjectDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archive/",
        ProjectArchiveUnarchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="project-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/summary/",
        ProjectSummaryAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-summary",
    ),
]
