from django.urls import path

from plane.app.views.project.workflow import (
    ProjectWorkflowEndpoint,
    WorkflowActivityEndpoint,
    WorkflowCreationPolicyEndpoint,
    WorkflowTransitionEndpoint,
)

urlpatterns = [
    path("workspaces/<str:slug>/projects/<uuid:project_id>/workflows/default/", ProjectWorkflowEndpoint.as_view()),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/default/states/",
        WorkflowCreationPolicyEndpoint.as_view(),
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/default/transitions/",
        WorkflowTransitionEndpoint.as_view(),
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/default/transitions/<uuid:pk>/",
        WorkflowTransitionEndpoint.as_view(),
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/workflows/default/activities/",
        WorkflowActivityEndpoint.as_view(),
    ),
]
