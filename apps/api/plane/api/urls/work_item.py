# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    WorkItemSubscriberListAPIEndpoint,
    WorkItemSubscribeAPIEndpoint,
    WorkItemReactionAPIEndpoint,
    WorkItemReactionDetailAPIEndpoint,
    WorkItemCommentReactionAPIEndpoint,
    WorkItemCommentReactionDetailAPIEndpoint,
    WorkItemDescriptionVersionListAPIEndpoint,
    WorkItemDescriptionVersionDetailAPIEndpoint,
    WorkItemSubItemsAPIEndpoint,
    WorkItemSubItemDetailAPIEndpoint,
    WorkItemArchiveAPIEndpoint,
    ArchivedWorkItemListAPIEndpoint,
    WorkItemBulkArchiveAPIEndpoint,
    WorkItemBulkDeleteAPIEndpoint,
    IssueListCreateAPIEndpoint,
    IssueDetailAPIEndpoint,
    IssueLinkListCreateAPIEndpoint,
    IssueLinkDetailAPIEndpoint,
    IssueCommentListCreateAPIEndpoint,
    IssueCommentDetailAPIEndpoint,
    IssueActivityListAPIEndpoint,
    IssueActivityDetailAPIEndpoint,
    IssueAttachmentListCreateAPIEndpoint,
    IssueAttachmentDetailAPIEndpoint,
    WorkspaceIssueAPIEndpoint,
    IssueSearchEndpoint,
    IssueRelationListCreateAPIEndpoint,
)

# Deprecated url patterns
old_url_patterns = [
    path(
        "workspaces/<str:slug>/issues/search/",
        IssueSearchEndpoint.as_view(http_method_names=["get"]),
        name="issue-search",
    ),
    path(
        "workspaces/<str:slug>/issues/<str:project_identifier>-<str:issue_identifier>/",
        WorkspaceIssueAPIEndpoint.as_view(http_method_names=["get"]),
        name="issue-by-identifier",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/",
        IssueListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="issue",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:pk>/",
        IssueDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="issue",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/links/",
        IssueLinkListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="link",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/links/<uuid:pk>/",
        IssueLinkDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="link",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/",
        IssueCommentListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="comment",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/<uuid:pk>/",
        IssueCommentDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="comment",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/activities/",
        IssueActivityListAPIEndpoint.as_view(http_method_names=["get"]),
        name="activity",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/activities/<uuid:pk>/",
        IssueActivityDetailAPIEndpoint.as_view(http_method_names=["get"]),
        name="activity",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/",
        IssueAttachmentListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="attachment",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/<uuid:pk>/",
        IssueAttachmentDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="issue-attachment",
    ),
]

# New url patterns with work-items as the prefix
new_url_patterns = [
    path(
        "workspaces/<str:slug>/work-items/search/",
        IssueSearchEndpoint.as_view(http_method_names=["get"]),
        name="work-item-search",
    ),
    path(
        "workspaces/<str:slug>/work-items/<str:project_identifier>-<str:issue_identifier>/",
        WorkspaceIssueAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-by-identifier",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/",
        IssueListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:pk>/",
        IssueDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/links/",
        IssueLinkListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-link-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/links/<uuid:pk>/",
        IssueLinkDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-link-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comments/",
        IssueCommentListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-comment-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comments/<uuid:pk>/",
        IssueCommentDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-comment-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/activities/",
        IssueActivityListAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-activity-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/activities/<uuid:pk>/",
        IssueActivityDetailAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-activity-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/attachments/",
        IssueAttachmentListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-attachment-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/attachments/<uuid:pk>/",
        IssueAttachmentDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-attachment-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/relations/",
        IssueRelationListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-relation-list",
    ),
]

lifecycle_url_patterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/sub-items/",
        WorkItemSubItemsAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-sub-items",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/sub-items/<uuid:sub_item_id>/",
        WorkItemSubItemDetailAPIEndpoint.as_view(http_method_names=["delete"]),
        name="work-item-sub-item-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/archive/",
        WorkItemArchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="work-item-archive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archived-work-items/",
        ArchivedWorkItemListAPIEndpoint.as_view(http_method_names=["get"]),
        name="archived-work-items",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/bulk-archive/",
        WorkItemBulkArchiveAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-bulk-archive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/bulk-delete/",
        WorkItemBulkDeleteAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-bulk-delete",
    ),
]

engagement_url_patterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/subscribers/",
        WorkItemSubscriberListAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-subscribers",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/subscribe/",
        WorkItemSubscribeAPIEndpoint.as_view(http_method_names=["get", "post", "delete"]),
        name="work-item-subscribe",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/reactions/",
        WorkItemReactionAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-reactions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/reactions/<str:reaction>/",
        WorkItemReactionDetailAPIEndpoint.as_view(http_method_names=["delete"]),
        name="work-item-reaction-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/comments/<uuid:comment_id>/reactions/",
        WorkItemCommentReactionAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-comment-reactions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/comments/<uuid:comment_id>/reactions/<str:reaction>/",
        WorkItemCommentReactionDetailAPIEndpoint.as_view(http_method_names=["delete"]),
        name="work-item-comment-reaction-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/description-versions/",
        WorkItemDescriptionVersionListAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-description-versions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/description-versions/<uuid:version_id>/",
        WorkItemDescriptionVersionDetailAPIEndpoint.as_view(http_method_names=["get"]),
        name="work-item-description-version-detail",
    ),
]

urlpatterns = old_url_patterns + new_url_patterns + lifecycle_url_patterns + engagement_url_patterns
