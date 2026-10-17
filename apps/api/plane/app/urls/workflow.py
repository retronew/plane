from django.urls import path

from plane.app.views.project.workflow import (
    ProjectIssueTypeEndpoint,
    ProjectWorkflowEndpoint,
    ProjectWorkflowListEndpoint,
    WorkflowActivityEndpoint,
    WorkflowCreationPolicyEndpoint,
    WorkflowMigrationEndpoint,
    WorkflowTransitionEndpoint,
)
from plane.app.views.project.workflow_approval import (
    WorkflowApprovalDecisionEndpoint,
    WorkflowApprovalEndpoint,
    WorkflowApprovalReapplyEndpoint,
)

from plane.app.views.project.custom_property import (
    ProjectCustomPropertyEndpoint,
    CustomPropertyOptionEndpoint,
    IssueTypeCustomPropertyEndpoint,
    IssueCustomPropertyValueEndpoint,
)

prefix = "workspaces/<str:slug>/projects/<uuid:project_id>/"
urlpatterns = [
    path(prefix + "custom-properties/", ProjectCustomPropertyEndpoint.as_view()),
    path(prefix + "custom-properties/<uuid:property_id>/", ProjectCustomPropertyEndpoint.as_view()),
    path(prefix + "custom-properties/<uuid:property_id>/options/", CustomPropertyOptionEndpoint.as_view()),
    path(
        prefix + "custom-properties/<uuid:property_id>/options/<uuid:option_id>/",
        CustomPropertyOptionEndpoint.as_view(),
    ),
    path(prefix + "issue-types/<uuid:type_id>/custom-properties/", IssueTypeCustomPropertyEndpoint.as_view()),
    path(
        prefix + "issue-types/<uuid:type_id>/custom-properties/<uuid:property_id>/",
        IssueTypeCustomPropertyEndpoint.as_view(),
    ),
    path(prefix + "issues/<uuid:issue_id>/custom-properties/", IssueCustomPropertyValueEndpoint.as_view()),
    path(prefix + "workflows/", ProjectWorkflowListEndpoint.as_view()),
    path(prefix + "workflows/preview/", WorkflowMigrationEndpoint.as_view()),
    path(prefix + "workflows/apply/", WorkflowMigrationEndpoint.as_view(), {"apply": True}),
    path(prefix + "issue-types/", ProjectIssueTypeEndpoint.as_view()),
    path(prefix + "issue-types/<uuid:type_id>/", ProjectIssueTypeEndpoint.as_view()),
    path(prefix + "issues/<uuid:issue_id>/approvals/", WorkflowApprovalEndpoint.as_view()),
    path(prefix + "issues/<uuid:issue_id>/approvals/reapply/", WorkflowApprovalReapplyEndpoint.as_view()),
    path(
        prefix + "issues/<uuid:issue_id>/approvals/<uuid:approval_id>/decide/",
        WorkflowApprovalDecisionEndpoint.as_view(),
    ),
]
for workflow_path in ("default", "<uuid:workflow_id>"):
    route = prefix + f"workflows/{workflow_path}/"
    urlpatterns += [
        path(route, ProjectWorkflowEndpoint.as_view()),
        path(route + "states/", WorkflowCreationPolicyEndpoint.as_view()),
        path(route + "transitions/", WorkflowTransitionEndpoint.as_view()),
        path(route + "transitions/<uuid:pk>/", WorkflowTransitionEndpoint.as_view()),
        path(route + "activities/", WorkflowActivityEndpoint.as_view()),
    ]
