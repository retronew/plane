import nh3
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from plane.app.views.base import BaseAPIView
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import (
    ProjectCategory,
    WorkspaceTemplate,
    Workspace,
    Project,
    ProjectMember,
    WorkspaceMember,
    State,
    Label,
    Module,
)
from plane.app.serializers.template_configuration import (
    ProjectTemplateConfigurationSerializer,
    WorkItemTemplateConfigurationSerializer,
)
from django.db.models import Q, Max
import json
from django.core.serializers.json import DjangoJSONEncoder


class CategorySerializer(serializers.ModelSerializer):
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", required=False)
    name = serializers.CharField(max_length=100, trim_whitespace=True)

    def validate(self, attrs):
        if self.instance and "group" in attrs and attrs["group"] != self.instance.group:
            raise serializers.ValidationError({"group": "The phase cannot be changed."})
        if self.instance and self.instance.is_default and attrs.get("is_default") is False:
            raise serializers.ValidationError({"is_default": "Choose another default first."})
        return attrs

    class Meta:
        model = ProjectCategory
        fields = ["id", "kind", "name", "color", "sort_order", "group", "description", "is_default"]
        read_only_fields = ["id", "kind"]


class TemplateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    description_html = serializers.CharField(max_length=100000, allow_blank=True, required=False)

    def validate_description_html(self, value):
        # Templates are portable text: never retain project-private asset/mention identifiers.
        return nh3.clean(
            value,
            tags={
                "p",
                "br",
                "strong",
                "em",
                "u",
                "s",
                "h1",
                "h2",
                "h3",
                "h4",
                "ul",
                "ol",
                "li",
                "blockquote",
                "pre",
                "code",
                "a",
                "table",
                "thead",
                "tbody",
                "tr",
                "th",
                "td",
                "hr",
            },
            attributes={"a": {"href", "title"}},
            url_schemes={"https", "http", "mailto"},
        )

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", "page"))
        project = attrs.get("project", getattr(self.instance, "project", None))
        workspace = self.context["workspace"]
        if project and project.workspace_id != workspace.id:
            raise serializers.ValidationError({"project": "Project must belong to this workspace."})
        config = attrs.get("configuration", getattr(self.instance, "configuration", {}))
        if kind == "project":
            schema = ProjectTemplateConfigurationSerializer(data=config)
        elif kind == "work_item":
            schema = WorkItemTemplateConfigurationSerializer(data=config)
        else:
            attrs["configuration"] = {}
            return attrs
        schema.is_valid(raise_exception=True)
        config = schema.validated_data
        if (
            kind == "project"
            and config.get("project_lead")
            and not WorkspaceMember.objects.filter(
                workspace=workspace, member_id=config["project_lead"], role__gte=15, is_active=True
            ).exists()
        ):
            raise serializers.ValidationError({"configuration": "Invalid project lead."})
        if kind == "work_item":
            for key, model in [("state_id", State), ("label_ids", Label), ("module_ids", Module)]:
                ids = [config[key]] if key == "state_id" and config[key] else (config[key] if key != "state_id" else [])
                if ids and (not project or model.objects.filter(project=project, id__in=ids).count() != len(set(ids))):
                    raise serializers.ValidationError({"configuration": "Invalid project references."})
            if config["assignee_ids"] and (
                not project
                or ProjectMember.objects.filter(
                    project=project, member_id__in=config["assignee_ids"], role__gte=15, is_active=True
                ).count()
                != len(set(config["assignee_ids"]))
            ):
                raise serializers.ValidationError({"configuration": "Invalid assignees."})
        attrs["configuration"] = json.loads(json.dumps(config, cls=DjangoJSONEncoder))
        return attrs

    class Meta:
        model = WorkspaceTemplate
        fields = [
            "id",
            "kind",
            "name",
            "title",
            "description_html",
            "priority",
            "updated_at",
            "short_description",
            "project",
            "configuration",
        ]
        read_only_fields = ["id", "updated_at"]


class WorkspaceConfigurationEndpoint(BaseAPIView):
    model = None
    serializer = None

    def objects_for(self, slug, kind=None):
        queryset = self.model.objects.filter(workspace__slug=slug)
        if self.model is ProjectCategory:
            if kind not in ["status", "label"]:
                from rest_framework.exceptions import NotFound

                raise NotFound()
            queryset = queryset.filter(kind=kind)
        if (
            self.model is WorkspaceTemplate
            and not WorkspaceMember.objects.filter(
                workspace__slug=slug, member=self.request.user, role=20, is_active=True
            ).exists()
        ):
            accessible = (
                Project.objects.filter(workspace__slug=slug)
                .filter(
                    Q(network=2)
                    | Q(project_projectmember__member=self.request.user, project_projectmember__is_active=True)
                )
                .values("id")
            )
            queryset = queryset.filter(Q(project__isnull=True) | Q(project_id__in=accessible))
        return queryset

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, kind=None, pk=None):
        queryset = self.objects_for(slug, kind)
        if pk:
            return Response(self.serializer(get_object_or_404(queryset, pk=pk)).data)
        return Response(self.serializer(queryset, many=True).data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, kind=None):
        self.objects_for(slug, kind)
        serializer = self.serializer(data=request.data, context={"workspace": get_object_or_404(Workspace, slug=slug)})
        serializer.is_valid(raise_exception=True)
        kwargs = {"workspace": get_object_or_404(Workspace, slug=slug)}
        if self.model is ProjectCategory:
            kwargs["kind"] = kind
        try:
            with transaction.atomic():
                Workspace.objects.select_for_update().get(slug=slug)
                if self.model is ProjectCategory and kind == "status" and serializer.validated_data.get("is_default"):
                    ProjectCategory.objects.filter(workspace__slug=slug, kind="status").update(is_default=False)
                if self.model is ProjectCategory:
                    kwargs["sort_order"] = (
                        ProjectCategory.objects.filter(workspace__slug=slug, kind=kind).aggregate(
                            value=Max("sort_order")
                        )["value"]
                        or 0
                    ) + 1000
                serializer.save(**kwargs)
        except IntegrityError:
            return Response({"name": ["A name already exists in this category."]}, status=400)
        return Response(serializer.data, status=201)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug, pk, kind=None):
        obj = get_object_or_404(self.objects_for(slug, kind), pk=pk)
        serializer = self.serializer(
            obj, data=request.data, partial=True, context={"workspace": get_object_or_404(Workspace, slug=slug)}
        )
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                Workspace.objects.select_for_update().get(slug=slug)
                if self.model is ProjectCategory and kind == "status" and serializer.validated_data.get("is_default"):
                    ProjectCategory.objects.filter(workspace__slug=slug, kind="status").update(is_default=False)
                serializer.save()
        except IntegrityError:
            return Response({"name": ["A name already exists in this category."]}, status=400)
        return Response(serializer.data)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    @transaction.atomic
    def delete(self, request, slug, pk, kind=None):
        Workspace.objects.select_for_update().get(slug=slug)
        obj = get_object_or_404(self.objects_for(slug, kind), pk=pk)
        if isinstance(obj, ProjectCategory) and (obj.status_projects.exists() or obj.label_projects.exists()):
            return Response({"error": "category_in_use"}, status=409)
        if isinstance(obj, ProjectCategory) and obj.kind == "status" and obj.workspace.project_states_enabled:
            if (
                obj.is_default
                or not ProjectCategory.objects.filter(workspace=obj.workspace, kind="status", group=obj.group)
                .exclude(pk=obj.pk)
                .exists()
            ):
                return Response({"error": "default_or_last_state"}, status=409)
        obj.delete()
        return Response(status=204)


class ProjectCategoryEndpoint(WorkspaceConfigurationEndpoint):
    model = ProjectCategory
    serializer = CategorySerializer


class WorkspaceTemplateEndpoint(WorkspaceConfigurationEndpoint):
    model = WorkspaceTemplate
    serializer = TemplateSerializer


class TemplateOptionsEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        projects = Project.objects.filter(workspace__slug=slug, archived_at__isnull=True)
        project = request.GET.get("project")
        result = {
            "projects": list(projects.values("id", "name")),
            "members": list(
                WorkspaceMember.objects.filter(workspace__slug=slug, role__gte=15, is_active=True).values(
                    "member_id", "member__display_name"
                )
            ),
        }
        if project:
            selected = get_object_or_404(projects, id=serializers.UUIDField().run_validation(project))
            result.update(
                states=list(State.objects.filter(project=selected).values("id", "name")),
                labels=list(Label.objects.filter(project=selected).values("id", "name")),
                modules=list(Module.objects.filter(project=selected).values("id", "name")),
                assignees=list(
                    ProjectMember.objects.filter(project=selected, role__gte=15, is_active=True).values(
                        "member_id", "member__display_name"
                    )
                ),
            )
        return Response(result)


class ProjectCategoryOrderEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, kind):
        if kind not in ["status", "label"]:
            return Response(status=404)
        field = serializers.ListField(child=serializers.UUIDField(), max_length=1000)
        ids = field.run_validation(request.data.get("ids"))
        with transaction.atomic():
            entries = list(ProjectCategory.objects.select_for_update().filter(workspace__slug=slug, kind=kind))
            if len(ids) != len(set(ids)) or set(ids) != {entry.id for entry in entries}:
                return Response({"error": "Refresh the list before reordering."}, status=409)
            positions = {identifier: index for index, identifier in enumerate(ids)}
            for entry in entries:
                entry.sort_order = positions[entry.id]
            ProjectCategory.objects.bulk_update(entries, ["sort_order"])
        return Response(status=204)


class ProjectStateSettingsEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        return Response({"enabled": get_object_or_404(Workspace, slug=slug).project_states_enabled})

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug):
        enabled = serializers.BooleanField().run_validation(request.data.get("enabled"))
        with transaction.atomic():
            workspace = get_object_or_404(Workspace.objects.select_for_update(), slug=slug)
            if enabled:
                groups = [
                    ("draft", "#60646C"),
                    ("planning", "#3E63DD"),
                    ("execution", "#F5A524"),
                    ("monitoring", "#8E4EC6"),
                    ("completed", "#30A46C"),
                    ("cancelled", "#E5484D"),
                ]
                for index, (group, color) in enumerate(groups):
                    if not ProjectCategory.objects.filter(workspace=workspace, kind="status", group=group).exists():
                        name = group.title()
                        if ProjectCategory.objects.filter(
                            workspace=workspace, kind="status", name__iexact=name
                        ).exists():
                            name += " (" + group + ")"
                        ProjectCategory.objects.create(
                            workspace=workspace,
                            kind="status",
                            name=name,
                            color=color,
                            group=group,
                            sort_order=index * 1000,
                        )
                states = ProjectCategory.objects.filter(workspace=workspace, kind="status")
                default = states.filter(is_default=True).first()
                if not default:
                    default = states.filter(group="draft").first()
                    default.is_default = True
                    default.save(update_fields=["is_default"])
                Project.objects.filter(workspace=workspace, status__isnull=True).update(status=default)
            workspace.project_states_enabled = enabled
            workspace.save(update_fields=["project_states_enabled"])
        return Response({"enabled": enabled})
