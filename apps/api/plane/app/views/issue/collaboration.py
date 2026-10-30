import base64
import binascii
import hmac
import json

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from plane.app.serializers.issue import IssueCreateSerializer, IssueDetailSerializer
from plane.app.views.base import BaseAPIView
from plane.bgtasks.issue_activities_task import issue_activity
from plane.bgtasks.webhook_task import model_activity
from plane.db.models import (
    Issue,
    IssueDescriptionDocument,
    Project,
    ProjectMember,
    WorkspaceMember,
    User,
    IntakeIssue,
)
from plane.services.collaboration_history import save_collaboration_history
from plane.services.issue_description import (
    collaboration_projection,
    description_hash,
    document_payload,
    DescriptionConflict,
)
from plane.utils.host import base_host


class DocumentWriteSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["slate-yjs-v1"])
    epoch = serializers.IntegerField(min_value=0)
    revision = serializers.IntegerField(min_value=0)
    state = serializers.CharField(max_length=14 * 1024 * 1024, trim_whitespace=False)
    source_hash = serializers.CharField(max_length=64, required=False)
    description_html = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    contributors = serializers.ListField(child=serializers.UUIDField(), max_length=100, required=False)

    def validate_state(self, value):
        try:
            value = base64.b64decode(value, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise serializers.ValidationError("Invalid base64 state") from exc
        if len(value) < 2 or len(value) > 10 * 1024 * 1024:
            raise serializers.ValidationError("State must be between 2 bytes and 10 MB")
        return value


def issue_access(issue, user):
    workspace_role = (
        WorkspaceMember.objects.filter(workspace_id=issue.workspace_id, member=user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )
    role = (
        ProjectMember.objects.filter(project_id=issue.project_id, member=user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )
    creator = bool(workspace_role and issue.created_by_id == user.pk)
    can_read = bool(role) or creator
    can_edit = creator or bool(role and (role >= 15 or workspace_role == 20))
    if issue.state.group == "triage":
        intake = IntakeIssue.objects.filter(issue=issue).first()
        can_read = bool(intake) and can_read
        can_edit = bool(intake) and (
            bool(role and (role == 20 or workspace_role == 20))
            or (creator and (bool(role) or workspace_role == 20) and (role != 5 or intake.created_by_id == user.pk))
        )
    return can_read, can_edit


class IssueCollaborationEndpoint(BaseAPIView):
    def get_issue(self, request, slug, project_id, issue_id):
        issue = get_object_or_404(
            Issue.objects.select_related("state"),
            pk=issue_id,
            project_id=project_id,
            workspace__slug=slug,
            archived_at__isnull=True,
            project__archived_at__isnull=True,
            is_draft=False,
        )
        can_read, can_edit = issue_access(issue, request.user)
        if not can_read:
            raise PermissionDenied()
        return issue, can_edit

    def get(self, request, slug, project_id, issue_id):
        with transaction.atomic():
            Issue.objects.select_for_update().filter(pk=issue_id, project_id=project_id).first()
            issue, can_edit = self.get_issue(request, slug, project_id, issue_id)
            document = IssueDescriptionDocument.objects.filter(issue=issue).first()
            return Response(document_payload(issue, document, can_edit))

    def post(self, request, slug, project_id, issue_id):
        return self.write(request, slug, project_id, issue_id, initializing=True)

    def patch(self, request, slug, project_id, issue_id):
        return self.write(request, slug, project_id, issue_id, initializing=False)

    def write(self, request, slug, project_id, issue_id, initializing):
        secret = settings.LIVE_SERVER_SECRET_KEY
        if not secret or not hmac.compare_digest(request.headers.get("live-server-secret-key", ""), secret):
            raise PermissionDenied("Live service credentials required")
        payload = DocumentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        with transaction.atomic():
            # Match WorkflowIssueWriteMixin's lock order.
            get_object_or_404(Project.objects.select_for_update(), pk=project_id, workspace__slug=slug)
            Issue.objects.select_for_update().filter(pk=issue_id, project_id=project_id).first()
            issue, can_edit = self.get_issue(request, slug, project_id, issue_id)
            if not initializing and not can_edit:
                raise PermissionDenied()
            document, _ = IssueDescriptionDocument.objects.get_or_create(issue=issue)
            if document.epoch != data["epoch"] or document.revision != data["revision"]:
                raise DescriptionConflict(document)
            if initializing:
                if document.state is not None or data.get("source_hash") != description_hash(issue.description_html):
                    raise DescriptionConflict(document)
            else:
                if document.state is None:
                    raise DescriptionConflict(document)
                if "description_html" not in data:
                    raise serializers.ValidationError({"description_html": "Required"})
                contributors = set(data.get("contributors", [])) | {request.user.pk}
                users = list(User.objects.filter(pk__in=contributors, is_active=True))
                if len(users) != len(contributors) or any(not issue_access(issue, user)[1] for user in users):
                    raise PermissionDenied("A contributor no longer has editing permission")
                before = json.dumps(IssueDetailSerializer(issue).data, cls=DjangoJSONEncoder)
                previous_html = issue.description_html
                serializer = IssueCreateSerializer(
                    issue,
                    data={"description_html": data["description_html"]},
                    partial=True,
                    context={
                        "request": request,
                        "project_id": project_id,
                        "allow_triage_state": issue.state.group == "triage",
                    },
                )
                serializer.is_valid(raise_exception=True)
                token = collaboration_projection.set(True)
                try:
                    issue = serializer.save()
                finally:
                    collaboration_projection.reset(token)
                document.contributors = sorted(str(user_id) for user_id in contributors)
                if previous_html != issue.description_html:
                    # Capture this exact committed projection, not a later asynchronous read.
                    save_collaboration_history(issue, request.user.pk)
                    requested = {"description_html": issue.description_html}
                    origin = base_host(request=request, is_app=True)
                    transaction.on_commit(
                        lambda: issue_activity.delay(
                            type="issue.activity.updated",
                            requested_data=json.dumps(requested),
                            actor_id=str(request.user.pk),
                            issue_id=str(issue.pk),
                            project_id=str(project_id),
                            current_instance=before,
                            epoch=int(timezone.now().timestamp()),
                            notification=True,
                            origin=origin,
                        )
                    )
                    transaction.on_commit(
                        lambda: model_activity.delay(
                            model_name="issue",
                            model_id=str(issue.pk),
                            requested_data=requested,
                            current_instance=before,
                            actor_id=request.user.pk,
                            slug=slug,
                            origin=origin,
                        )
                    )
            document.state = data["state"]
            document.revision += 1
            document.source_hash = description_hash(issue.description_html)
            document.save()
            return Response(document_payload(issue, document, can_edit))
