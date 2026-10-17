from django.urls import path

from plane.app.views.project.workflow_runner import (
    WorkflowCredentialDetailEndpoint,
    WorkflowCredentialEndpoint,
    WorkflowExecutionEndpoint,
    WorkflowExecutionRetryEndpoint,
    WorkflowExecutionResolveEndpoint,
    WorkflowRunnerRPCEndpoint,
    WorkflowScriptDetailEndpoint,
    WorkflowScriptEndpoint,
    WorkflowScriptTestEndpoint,
    WorkflowScriptVersionEndpoint,
)

PROJECT = "workspaces/<str:slug>/projects/<uuid:project_id>/"

urlpatterns = [
    path(PROJECT + "workflow-scripts/", WorkflowScriptEndpoint.as_view(), name="workflow-scripts"),
    path(PROJECT + "workflow-scripts/test/", WorkflowScriptTestEndpoint.as_view(), name="workflow-script-test"),
    path(PROJECT + "workflow-scripts/<uuid:pk>/", WorkflowScriptDetailEndpoint.as_view(), name="workflow-script"),
    path(
        PROJECT + "workflow-scripts/<uuid:pk>/versions/",
        WorkflowScriptVersionEndpoint.as_view(),
        name="workflow-script-versions",
    ),
    path(PROJECT + "workflow-executions/", WorkflowExecutionEndpoint.as_view(), name="workflow-executions"),
    path(PROJECT + "workflow-executions/<uuid:pk>/", WorkflowExecutionEndpoint.as_view(), name="workflow-execution"),
    path(
        PROJECT + "workflow-executions/<uuid:pk>/retry/",
        WorkflowExecutionRetryEndpoint.as_view(),
        name="workflow-execution-retry",
    ),
    path(
        PROJECT + "workflow-executions/<uuid:pk>/resolve/",
        WorkflowExecutionResolveEndpoint.as_view(),
        name="workflow-execution-resolve",
    ),
    path(PROJECT + "workflow-credentials/", WorkflowCredentialEndpoint.as_view(), name="workflow-credentials"),
    path(
        PROJECT + "workflow-credentials/<uuid:pk>/",
        WorkflowCredentialDetailEndpoint.as_view(),
        name="workflow-credential",
    ),
    path("internal/workflow-runner/rpc/", WorkflowRunnerRPCEndpoint.as_view(), name="workflow-runner-rpc"),
]
