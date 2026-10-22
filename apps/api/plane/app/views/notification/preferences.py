from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework import serializers

from plane.app.views.base import BaseAPIView
from plane.db.models import ProjectMember, WorkspaceMember
from plane.utils.notification_preferences import CHANNELS, EVENTS, preference_response, update_preferences


class NotificationPreferenceScopeSerializer(serializers.Serializer):
    workspace_id = serializers.UUIDField(required=False)
    project_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        if "project_id" in attrs and "workspace_id" not in attrs:
            raise serializers.ValidationError("project_id requires workspace_id")
        return attrs


def validate_preferences(data, is_global):
    if not isinstance(data, dict):
        raise ValidationError("Expected an object")
    allowed = {"events", "channels", "override_scopes"} if is_global else {"events"}
    if set(data) - allowed:
        raise ValidationError("Unknown or global-only preference fields")
    for field in ("channels", "override_scopes"):
        if field not in data:
            continue
        values = data[field]
        if not isinstance(values, dict) or set(values) - set(CHANNELS):
            raise ValidationError({field: "Expected known channels"})
        if any(type(value) is not bool for value in values.values()):
            raise ValidationError({field: "Expected boolean switches"})
    events = data.get("events", {})
    if not isinstance(events, dict) or set(events) - set(CHANNELS):
        raise ValidationError({"events": "Expected known channels"})
    for values in events.values():
        if not isinstance(values, dict) or set(values) - set(EVENTS):
            raise ValidationError({"events": "Expected known events"})
        if any(type(value) is not bool and not (value is None and not is_global) for value in values.values()):
            raise ValidationError({"events": "Expected boolean values (or null to inherit at a local scope)"})
    return data


class UnifiedNotificationPreferenceEndpoint(BaseAPIView):
    """Scope is always personal and must belong to the authenticated member."""

    def get_scope(self, request):
        if set(request.query_params) - {"workspace_id", "project_id"}:
            raise ValidationError("Unknown scope parameter")
        serializer = NotificationPreferenceScopeSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        workspace_id = serializer.validated_data.get("workspace_id")
        project_id = serializer.validated_data.get("project_id")
        if (
            workspace_id
            and not WorkspaceMember.objects.filter(
                workspace_id=workspace_id, workspace__deleted_at__isnull=True, member=request.user, is_active=True
            ).exists()
        ):
            raise NotFound("Workspace membership not found")
        if (
            project_id
            and not ProjectMember.objects.filter(
                project_id=project_id,
                project__deleted_at__isnull=True,
                project__workspace_id=workspace_id,
                workspace_id=workspace_id,
                workspace__deleted_at__isnull=True,
                member=request.user,
                is_active=True,
            ).exists()
        ):
            raise NotFound("Project membership not found")
        return workspace_id, project_id

    def get(self, request):
        workspace, project = self.get_scope(request)
        return Response(preference_response(request.user, workspace, project))

    def patch(self, request):
        workspace, project = self.get_scope(request)
        data = validate_preferences(request.data, is_global=workspace is None)
        update_preferences(request.user, workspace, project, data)
        return Response(preference_response(request.user, workspace, project))
