import math

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.views.project.workflow import WorkflowBaseView
from plane.db.models import (
    CustomPropertyOption,
    Issue,
    IssueTypeCustomProperty,
    ProjectCustomProperty,
    ProjectIssueType,
    ProjectMember,
)
from plane.services.custom_properties import (
    apply_property_merge,
    merge_property_plan,
    effective_properties,
    issue_property_values,
    validate_config,
    validate_value,
)


class PropertySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False)
    property_type = serializers.ChoiceField(choices=[v[0] for v in ProjectCustomProperty.PROPERTY_TYPES])
    config = serializers.JSONField(required=False)
    is_active = serializers.BooleanField(required=False)
    is_required = serializers.BooleanField(required=False)
    sort_order = serializers.FloatField(required=False)

    def validate_sort_order(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Must be finite.")
        return value


class OptionSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", required=False)
    sort_order = serializers.FloatField(required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_sort_order(self, value):
        return PropertySerializer().validate_sort_order(value)


class TypePropertySerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
    is_required = serializers.BooleanField()


def representation(prop):
    return {
        "id": prop.pk,
        "name": prop.name,
        "description": prop.description,
        "property_type": prop.property_type,
        "config": prop.config,
        "is_active": prop.is_active,
        "is_archived": prop.is_archived,
        "is_required": prop.is_required,
        "sort_order": prop.sort_order,
        "options": [option_representation(o) for o in prop.options.filter(deleted_at__isnull=True)],
        "type_settings": [
            {
                "type_id": b.project_issue_type.issue_type_id,
                "project_issue_type_id": b.project_issue_type_id,
                "is_active": b.is_active,
                "is_required": b.is_required,
            }
            for b in prop.type_settings.filter(
                deleted_at__isnull=True, project_issue_type__deleted_at__isnull=True
            ).select_related("project_issue_type")
        ],
    }


def option_representation(option):
    return {
        "id": option.pk,
        "name": option.name,
        "color": option.color,
        "sort_order": option.sort_order,
        "is_active": option.is_active,
        "is_archived": option.is_archived,
    }


class CustomPropertyBaseView(WorkflowBaseView):
    def property(self, project, property_id):
        return get_object_or_404(ProjectCustomProperty, project=project, pk=property_id, is_archived=False)


class MergeSourcesSerializer(serializers.Serializer):
    source_property_ids = serializers.ListField(child=serializers.UUIDField(), min_length=2, max_length=100)

    def validate_source_property_ids(self, value):
        if len(set(value)) != len(value):
            raise ValidationError("CUSTOM_PROPERTY_MERGE_DUPLICATE_SOURCES")
        return value


class MergePropertySerializer(MergeSourcesSerializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True)


class CustomPropertyMergeEndpoint(CustomPropertyBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, preview=False):
        project, _ = self.project(request, slug, project_id, write=True)
        serializer = (MergeSourcesSerializer if preview else MergePropertySerializer)(data=request.data)
        if not serializer.is_valid():
            raise ValidationError({"code": "CUSTOM_PROPERTY_MERGE_INVALID_REQUEST", "errors": serializer.errors})
        data = serializer.validated_data
        plan = merge_property_plan(project, data["source_property_ids"])
        if preview:
            return Response({"can_merge": True, **plan[-1]})
        prop, counts = apply_property_merge(project, plan, data["name"], data["description"])
        return Response({"property": representation(prop), **counts}, status=201)


class ProjectCustomPropertyEndpoint(CustomPropertyBaseView):
    def get(self, request, slug, project_id, property_id=None):
        project, can_manage = self.project(request, slug, project_id)
        if property_id:
            return Response(representation(get_object_or_404(ProjectCustomProperty, project=project, pk=property_id)))
        rows = [representation(p) for p in ProjectCustomProperty.objects.filter(project=project, is_archived=False)]
        return Response({"results": rows, "count": len(rows), "can_manage": can_manage})

    @transaction.atomic
    def post(self, request, slug, project_id):
        project, _ = self.project(request, slug, project_id, write=True)
        serializer = PropertySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data["config"] = validate_config(data["property_type"], data.get("config", {}), data.get("is_required", False))
        if ProjectCustomProperty.objects.filter(project=project, name=data["name"], is_archived=False).exists():
            raise ValidationError({"name": "CUSTOM_PROPERTY_DUPLICATE_NAME"})
        options = OptionSerializer(many=True, data=request.data.get("options", []))
        options.is_valid(raise_exception=True)
        rows = options.validated_data
        if len(rows) > 500 or (rows and data["property_type"] != "dropdown"):
            raise ValidationError({"options": "CUSTOM_PROPERTY_INVALID_OPTIONS"})
        if len({row["name"] for row in rows}) != len(rows):
            raise ValidationError({"options": "CUSTOM_PROPERTY_DUPLICATE_OPTION"})
        prop = ProjectCustomProperty.objects.create(project=project, **data)
        for row in rows:
            CustomPropertyOption.objects.create(project=project, property=prop, **row)
        if prop.property_type == "dropdown":
            prop.config["default_value"] = validate_value(prop, prop.config.get("default_value"), project.pk)
            prop.save(update_fields=["config", "updated_at"])
        if request.data.get("type_id"):
            type_id = serializers.UUIDField().run_validation(request.data["type_id"])
            binding = get_object_or_404(ProjectIssueType, project=project, issue_type_id=type_id)
            IssueTypeCustomProperty.objects.create(
                project=project,
                property=prop,
                project_issue_type=binding,
                is_active=True,
                is_required=prop.is_required,
            )
        return Response(representation(prop), status=201)

    @transaction.atomic
    def patch(self, request, slug, project_id, property_id):
        project, _ = self.project(request, slug, project_id, write=True)
        prop = self.property(project, property_id)
        serializer = PropertySerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("property_type", prop.property_type) != prop.property_type:
            raise ValidationError({"property_type": "CUSTOM_PROPERTY_TYPE_IMMUTABLE"})
        config = validate_config(
            prop.property_type,
            {**prop.config, **data.get("config", {})} if isinstance(data.get("config", {}), dict) else data["config"],
            data.get("is_required", prop.is_required),
        )
        if config.get("multiple") != prop.config.get("multiple"):
            raise ValidationError({"config": "CUSTOM_PROPERTY_CARDINALITY_IMMUTABLE"})
        if config.get("read_only") and prop.type_settings.filter(is_required=True).exists():
            raise ValidationError({"config": "CUSTOM_PROPERTY_REQUIRED_NOT_SUPPORTED"})
        if (
            "name" in data
            and ProjectCustomProperty.objects.filter(project=project, name=data["name"], is_archived=False)
            .exclude(pk=prop.pk)
            .exists()
        ):
            raise ValidationError({"name": "CUSTOM_PROPERTY_DUPLICATE_NAME"})
        data["config"] = config
        for key, value in data.items():
            setattr(prop, key, value)
        if "options" in request.data:
            raise ValidationError({"options": "Use the options endpoint to edit existing options."})
        if prop.property_type == "dropdown" and "default_value" in data.get("config", {}):
            prop.config["default_value"] = validate_value(prop, prop.config.get("default_value"), project.pk)
            prop.save(update_fields=["config", "updated_at"])
        prop.save()
        return Response(representation(prop))

    @transaction.atomic
    def delete(self, request, slug, project_id, property_id):
        project, _ = self.project(request, slug, project_id, write=True)
        prop = self.property(project, property_id)
        if prop.is_active:
            raise ValidationError({"is_active": "CUSTOM_PROPERTY_DEACTIVATE_BEFORE_DELETE"})
        # Archive instead of soft-delete: async cascade deletion would destroy metadata.
        prop.is_archived = True
        prop.save(update_fields=["is_archived", "updated_at"])
        return Response(status=204)


def remove_default_option(prop, option):
    default = prop.config.get("default_value")
    key = str(option.pk)
    if default == key or (isinstance(default, list) and key in default):
        prop.config = {
            **prop.config,
            "default_value": [v for v in default if v != key] if isinstance(default, list) else None,
        }
        prop.save(update_fields=["config", "updated_at"])


class CustomPropertyOptionEndpoint(CustomPropertyBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, property_id, option_id=None):
        project, _ = self.project(request, slug, project_id, write=True)
        prop = self.property(project, property_id)
        if prop.property_type != "dropdown":
            raise ValidationError({"property_type": "CUSTOM_PROPERTY_OPTIONS_NOT_SUPPORTED"})
        option = (
            get_object_or_404(CustomPropertyOption, project=project, property=prop, pk=option_id, is_archived=False)
            if option_id
            else None
        )
        serializer = OptionSerializer(data=request.data, partial=option is not None)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        name = data.get("name", option.name if option else None)
        duplicates = CustomPropertyOption.objects.filter(property=prop, name=name, is_archived=False)
        if option:
            duplicates = duplicates.exclude(pk=option.pk)
        if duplicates.exists():
            raise ValidationError({"name": "CUSTOM_PROPERTY_DUPLICATE_OPTION"})
        if option:
            for key, value in data.items():
                setattr(option, key, value)
            option.save()
            if not option.is_active:
                remove_default_option(prop, option)
        else:
            option = CustomPropertyOption.objects.create(project=project, property=prop, **data)
        return Response(option_representation(option), status=200 if option_id else 201)

    def patch(self, request, slug, project_id, property_id, option_id):
        return self.post(request, slug, project_id, property_id, option_id)

    @transaction.atomic
    def delete(self, request, slug, project_id, property_id, option_id):
        project, _ = self.project(request, slug, project_id, write=True)
        prop = self.property(project, property_id)
        option = get_object_or_404(
            CustomPropertyOption, project=project, property=prop, pk=option_id, is_archived=False
        )
        option.is_active, option.is_archived = False, True
        option.save(update_fields=["is_active", "is_archived", "updated_at"])
        remove_default_option(prop, option)
        return Response(status=204)


class IssueTypeCustomPropertyEndpoint(CustomPropertyBaseView):
    def get(self, request, slug, project_id, type_id):
        project, can_manage = self.project(request, slug, project_id)
        get_object_or_404(ProjectIssueType, project=project, issue_type_id=type_id)
        rows = [
            {**representation(p), "effective_is_active": active, "effective_is_required": required}
            for p, active, required in effective_properties(project.pk, type_id)
        ]
        return Response({"results": rows, "count": len(rows), "can_manage": can_manage})

    @transaction.atomic
    def put(self, request, slug, project_id, type_id, property_id):
        project, _ = self.project(request, slug, project_id, write=True)
        binding = get_object_or_404(ProjectIssueType, project=project, issue_type_id=type_id)
        prop = self.property(project, property_id)
        serializer = TypePropertySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        validate_config(prop.property_type, prop.config, data["is_required"])
        IssueTypeCustomProperty.objects.update_or_create(
            project=project,
            property=prop,
            project_issue_type=binding,
            defaults={"workspace_id": project.workspace_id, **data},
        )
        return Response(
            {
                **representation(prop),
                "effective_is_active": prop.is_active and data["is_active"],
                "effective_is_required": data["is_required"],
            }
        )


class IssueCustomPropertyValueEndpoint(CustomPropertyBaseView):
    def issue(self, request, project, issue_id, write=False):
        issue = get_object_or_404(
            Issue.objects.select_for_update() if write else Issue.objects.all(), pk=issue_id, project=project
        )
        member = ProjectMember.objects.get(project=project, member=request.user, is_active=True)
        if member.role == 5 and not project.guest_view_all_features and issue.created_by_id != request.user.pk:
            raise PermissionDenied()
        if write and member.role < 15 and issue.created_by_id != request.user.pk:
            raise PermissionDenied()
        return issue

    def get(self, request, slug, project_id, issue_id):
        project, _ = self.project(request, slug, project_id)
        issue = self.issue(request, project, issue_id)
        return Response({"values": issue.custom_properties})

    @transaction.atomic
    def put(self, request, slug, project_id, issue_id):
        project, _ = self.project(request, slug, project_id)
        # Serialize setting and issue mutations in the same order as normal issue writes.
        from plane.db.models import Project

        project = Project.objects.select_for_update().get(pk=project.pk)
        issue = self.issue(request, project, issue_id, write=True)
        serializer = serializers.DictField(child=serializers.JSONField(allow_null=True)).run_validation(
            request.data.get("values")
        )
        issue.custom_properties = issue_property_values(project.pk, {"custom_properties": serializer}, issue)
        issue.save(update_fields=["custom_properties", "updated_at", "updated_by"])
        return Response({"values": issue.custom_properties})
