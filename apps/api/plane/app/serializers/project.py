# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Python imports
import re

# Module imports
from .base import BaseSerializer, DynamicBaseSerializer
from django.db.models import Max
from plane.app.serializers.workspace import WorkspaceLiteSerializer
from plane.app.serializers.user import UserLiteSerializer, UserAdminLiteSerializer
from plane.db.models import (
    Project,
    Workspace,
    ProjectCategory,
    ProjectMember,
    ProjectMemberInvite,
    WorkspaceMember,
    ProjectIdentifier,
    DeployBoard,
    ProjectPublicMember,
    IssueSequence,
)
from plane.utils.content_validator import (
    validate_html_content,
)


class ProjectSerializer(BaseSerializer):
    from plane.app.serializers.template_configuration import ProjectTemplateConfigurationSerializer

    template_configuration = ProjectTemplateConfigurationSerializer(write_only=True, required=False)
    member_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False, max_length=1000)

    workspace_detail = WorkspaceLiteSerializer(source="workspace", read_only=True)
    inbox_view = serializers.BooleanField(read_only=True, source="intake_view")

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["workspace", "deleted_at"]

    def validate_name(self, name):
        project_id = self.instance.id if self.instance else None
        workspace_id = self.context["workspace_id"]

        if re.match(Project.FORBIDDEN_IDENTIFIER_CHARS_PATTERN, name):
            raise serializers.ValidationError(detail="PROJECT_NAME_CANNOT_CONTAIN_SPECIAL_CHARACTERS")

        project = Project.objects.filter(name=name, workspace_id=workspace_id)

        if project_id:
            project = project.exclude(id=project_id)

        if project.exists():
            raise serializers.ValidationError(
                detail="PROJECT_NAME_ALREADY_EXIST",
            )

        return name

    def validate_identifier(self, identifier):
        project_id = self.instance.id if self.instance else None
        workspace_id = self.context["workspace_id"]

        if re.match(Project.FORBIDDEN_IDENTIFIER_CHARS_PATTERN, identifier):
            raise serializers.ValidationError(detail="PROJECT_IDENTIFIER_CANNOT_CONTAIN_SPECIAL_CHARACTERS")

        project = Project.objects.filter(identifier=identifier, workspace_id=workspace_id)

        if project_id:
            project = project.exclude(id=project_id)

        if project.exists():
            raise serializers.ValidationError(
                detail="PROJECT_IDENTIFIER_ALREADY_EXIST",
            )

        return identifier

    def validate(self, data):
        if self.instance and "template_configuration" in data:
            raise serializers.ValidationError({"template_configuration": "Only supported when creating a project."})
        workspace_id = self.context.get("workspace_id") or (self.instance.workspace_id if self.instance else None)
        if data.get("status") and (data["status"].workspace_id != workspace_id or data["status"].kind != "status"):
            raise serializers.ValidationError({"status": "Invalid workspace project status."})
        if any(label.workspace_id != workspace_id or label.kind != "label" for label in data.get("labels", [])):
            raise serializers.ValidationError({"labels": "Invalid workspace project labels."})
        start_date = data.get("start_date", self.instance.start_date if self.instance else None)
        target_date = data.get("target_date", self.instance.target_date if self.instance else None)
        if start_date and target_date and target_date < start_date:
            raise serializers.ValidationError({"target_date": "End date must not precede start date."})
        if "member_ids" in data:
            if self.instance:
                raise serializers.ValidationError({"member_ids": "Only supported when creating a project."})
            member_ids = list(dict.fromkeys(data["member_ids"]))
            allowed = set(
                WorkspaceMember.objects.filter(
                    workspace_id=workspace_id,
                    member_id__in=member_ids,
                    is_active=True,
                    member__is_active=True,
                    member__is_bot=False,
                ).values_list("member_id", flat=True)
            )
            if set(member_ids) != allowed:
                raise serializers.ValidationError({"member_ids": "Select active members of this workspace."})
            data["member_ids"] = member_ids
        # Validate description content for security
        if "description_html" in data and data["description_html"]:
            is_valid, error_msg, sanitized_html = validate_html_content(str(data["description_html"]))
            # Update the data with sanitized HTML if available
            if sanitized_html is not None:
                data["description_html"] = sanitized_html

            if not is_valid:
                raise serializers.ValidationError({"error": "html content is not valid"})

        return data

    def create(self, validated_data):
        workspace_id = self.context["workspace_id"]

        member_ids = validated_data.pop("member_ids", [])
        template_configuration = validated_data.pop("template_configuration", None)
        labels = validated_data.pop("labels", [])
        if (
            not validated_data.get("status")
            and Workspace.objects.filter(id=workspace_id, project_states_enabled=True).exists()
        ):
            validated_data["status"] = ProjectCategory.objects.filter(
                workspace_id=workspace_id, kind="status", is_default=True
            ).first()
        project = Project.objects.create(**validated_data, workspace_id=workspace_id)
        project.labels.set(labels)
        project.template_configuration = template_configuration
        project.initial_member_ids = member_ids

        ProjectIdentifier.objects.create(name=project.identifier, project=project, workspace_id=workspace_id)

        return project


class ProjectLiteSerializer(BaseSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "identifier",
            "name",
            "cover_image",
            "cover_image_url",
            "logo_props",
            "description",
        ]
        read_only_fields = fields


class ProjectListSerializer(DynamicBaseSerializer):
    is_favorite = serializers.BooleanField(read_only=True)
    sort_order = serializers.FloatField(read_only=True)
    member_role = serializers.IntegerField(read_only=True)
    anchor = serializers.CharField(read_only=True)
    members = serializers.SerializerMethodField()
    cover_image_url = serializers.CharField(read_only=True)
    inbox_view = serializers.BooleanField(read_only=True, source="intake_view")
    next_work_item_sequence = serializers.SerializerMethodField()

    def get_members(self, obj):
        project_members = getattr(obj, "members_list", None)
        if project_members is not None:
            # Filter members by the project ID
            return [member.member_id for member in project_members if member.is_active and not member.member.is_bot]
        return []

    def get_next_work_item_sequence(self, obj):
        """Get the next sequence ID that will be assigned to a new issue"""
        max_sequence = IssueSequence.objects.filter(project_id=obj.id).aggregate(max_seq=Max("sequence"))["max_seq"]
        return (max_sequence + 1) if max_sequence else 1

    class Meta:
        model = Project
        fields = "__all__"


class ProjectDetailSerializer(BaseSerializer):
    # workspace = WorkSpaceSerializer(read_only=True)
    default_assignee = UserLiteSerializer(read_only=True)
    project_lead = UserLiteSerializer(read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)
    sort_order = serializers.FloatField(read_only=True)
    member_role = serializers.IntegerField(read_only=True)
    anchor = serializers.CharField(read_only=True)

    class Meta:
        model = Project
        fields = "__all__"


class ProjectMemberSerializer(BaseSerializer):
    workspace = WorkspaceLiteSerializer(read_only=True)
    project = ProjectLiteSerializer(read_only=True)
    member = UserLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = "__all__"


class ProjectMemberPreferenceSerializer(BaseSerializer):
    class Meta:
        model = ProjectMember
        fields = ["preferences", "project_id", "member_id", "workspace_id"]

    def validate_preferences(self, value):
        preferences = self.instance.preferences

        preferences.update(value)
        return preferences


class ProjectMemberAdminSerializer(BaseSerializer):
    workspace = WorkspaceLiteSerializer(read_only=True)
    project = ProjectLiteSerializer(read_only=True)
    member = UserAdminLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = "__all__"


class ProjectMemberRoleSerializer(DynamicBaseSerializer):
    original_role = serializers.IntegerField(source="role", read_only=True)

    class Meta:
        model = ProjectMember
        fields = ("id", "role", "member", "project", "original_role", "created_at")
        read_only_fields = ["original_role", "created_at"]


class ProjectMemberInviteSerializer(BaseSerializer):
    project = ProjectLiteSerializer(read_only=True)
    workspace = WorkspaceLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMemberInvite
        fields = "__all__"


class ProjectMemberInvitePublicSerializer(BaseSerializer):
    """Safe read-only serializer for the public project invite GET endpoint.

    Intentionally excludes ``email`` and ``token`` so that an unauthenticated
    caller cannot retrieve the invitee's email address or the acceptance token
    (GHSA-2r58-hgv7-635q).
    """

    project = ProjectLiteSerializer(read_only=True)
    workspace = WorkspaceLiteSerializer(read_only=True)

    class Meta:
        model = ProjectMemberInvite
        fields = [
            "id",
            "project",
            "workspace",
            "role",
            "message",
            "accepted",
            "responded_at",
        ]
        read_only_fields = fields


class ProjectIdentifierSerializer(BaseSerializer):
    class Meta:
        model = ProjectIdentifier
        fields = "__all__"


class ProjectMemberLiteSerializer(BaseSerializer):
    member = UserLiteSerializer(read_only=True)
    is_subscribed = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ["member", "id", "is_subscribed"]
        read_only_fields = fields


class DeployBoardSerializer(BaseSerializer):
    project_details = ProjectLiteSerializer(read_only=True, source="project")
    workspace_detail = WorkspaceLiteSerializer(read_only=True, source="workspace")

    class Meta:
        model = DeployBoard
        fields = "__all__"
        read_only_fields = ["workspace", "project", "anchor"]


class ProjectPublicMemberSerializer(BaseSerializer):
    class Meta:
        model = ProjectPublicMember
        fields = "__all__"
        read_only_fields = ["workspace", "project", "member"]
