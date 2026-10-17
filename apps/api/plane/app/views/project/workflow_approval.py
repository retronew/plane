from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response

from plane.app.views.project.workflow import WorkflowBaseView
from plane.db.models import Issue, Project
from plane.db.models.workflow import WorkflowApproval
from plane.services.workflow_approval import approval_representation, decide_approval, sync_issue_approval
from plane.utils.workflow import _eligible_actor, workflow_conflict, workflow_error


class DecisionSerializer(serializers.Serializer):
    transition_id = serializers.UUIDField()
    outcome = serializers.ChoiceField(choices=["approve", "reject"])
    version = serializers.IntegerField(min_value=1)
    idempotency_key = serializers.CharField(max_length=128, allow_blank=False)


class WorkflowApprovalEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id, issue_id):
        self.project(request, slug, project_id)
        get_object_or_404(Issue, project_id=project_id, pk=issue_id)
        approvals = WorkflowApproval.objects.filter(project_id=project_id, issue_id=issue_id)
        results = [approval_representation(a, request.user) for a in approvals]
        return Response({"pending": next((a for a in results if a["status"] == "pending"), None), "results": results})


class WorkflowApprovalDecisionEndpoint(WorkflowBaseView):
    def post(self, request, slug, project_id, issue_id, approval_id):
        self.project(request, slug, project_id)
        get_object_or_404(WorkflowApproval, project_id=project_id, issue_id=issue_id, pk=approval_id)
        serializer = DecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approval = decide_approval(project_id, issue_id, approval_id, actor=request.user, **serializer.validated_data)
        return Response(approval_representation(approval, request.user))


class WorkflowApprovalReapplyEndpoint(WorkflowBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, issue_id):
        self.project(request, slug, project_id)
        if not _eligible_actor(project_id, request.user):
            workflow_error("WORKFLOW_APPROVER_NOT_ALLOWED")
        Project.objects.select_for_update().get(pk=project_id)
        issue = get_object_or_404(Issue.objects.select_for_update(), project_id=project_id, pk=issue_id)
        pending = WorkflowApproval.objects.filter(issue=issue, status="pending").first()
        if "version" in request.data and (not pending or pending.version != request.data["version"]):
            workflow_conflict()
        approval = sync_issue_approval(issue, actor=request.user, force=True)
        if not approval:
            workflow_error("WORKFLOW_APPROVAL_NOT_APPLICABLE")
        return Response(approval_representation(approval, request.user), status=201)
