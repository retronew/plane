from rest_framework import serializers


class TemplateChildSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description_html = serializers.CharField(max_length=100000, allow_blank=True, default="<p></p>")

    def validate_description_html(self, value):
        import nh3

        return nh3.clean(
            value,
            tags={"p", "br", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "pre", "code", "a"},
            attributes={"a": {"href", "title"}},
            url_schemes={"https", "http", "mailto"},
        )


class TemplateStateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", default="#60646C")
    group = serializers.ChoiceField(
        choices=["backlog", "unstarted", "started", "completed", "cancelled"], default="unstarted"
    )
    default = serializers.BooleanField(default=False)


class TemplateLabelSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", default="#60646C")


class ProjectTemplateConfigurationSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=10000, allow_blank=True, default="")
    network = serializers.ChoiceField(choices=[0, 2], default=2)
    project_lead = serializers.UUIDField(allow_null=True, default=None)
    cycle_view = serializers.BooleanField(default=False)
    module_view = serializers.BooleanField(default=False)
    page_view = serializers.BooleanField(default=True)
    issue_views_view = serializers.BooleanField(default=False)
    intake_view = serializers.BooleanField(default=False)
    states = TemplateStateSerializer(many=True, default=list, max_length=50)
    labels = TemplateLabelSerializer(many=True, default=list, max_length=100)
    work_items = TemplateChildSerializer(many=True, default=list, max_length=50)

    def validate(self, data):
        for key in ["states", "labels"]:
            names = [entry["name"].casefold() for entry in data[key]]
            if len(names) != len(set(names)):
                raise serializers.ValidationError({key: "Names must be unique."})
        if sum(entry["default"] for entry in data["states"]) > 1:
            raise serializers.ValidationError({"states": "Only one default state is allowed."})
        return data


class WorkItemTemplateChildSerializer(TemplateChildSerializer):
    type_id = serializers.UUIDField(allow_null=True, required=False)
    state_id = serializers.UUIDField(allow_null=True, required=False)
    priority = serializers.ChoiceField(choices=["none", "low", "medium", "high", "urgent"], required=False)
    assignee_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, required=False)
    label_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, required=False)


def validate_work_item_template_references(config, project):
    from plane.db.models import Label, Module, ProjectIssueType, ProjectMember, State

    entries = [config, *config.get("children", [])]
    for entry in entries:
        for key, model in [("state_id", State), ("label_ids", Label), ("module_ids", Module)]:
            value = entry.get(key)
            ids = [value] if key == "state_id" and value else (value or [])
            if ids and (
                not project
                or model.objects.filter(workspace_id=project.workspace_id, project=project, id__in=ids).count()
                != len(set(ids))
            ):
                raise serializers.ValidationError({key: "Invalid project references."})
        type_id = entry.get("type_id")
        if type_id and (
            not project
            or not ProjectIssueType.objects.filter(
                project=project,
                issue_type_id=type_id,
                issue_type__workspace_id=project.workspace_id,
                issue_type__is_active=True,
                issue_type__deleted_at__isnull=True,
            ).exists()
        ):
            raise serializers.ValidationError({"type_id": "Invalid project type."})
        assignees = entry.get("assignee_ids", [])
        if assignees and (
            not project
            or ProjectMember.objects.filter(
                workspace_id=project.workspace_id,
                project=project,
                member_id__in=assignees,
                role__gte=15,
                is_active=True,
            ).count()
            != len(set(assignees))
        ):
            raise serializers.ValidationError({"assignee_ids": "Invalid assignees."})


class TemplateLogoIconSerializer(serializers.Serializer):
    name = serializers.RegexField(r"^[a-zA-Z0-9_-]{1,100}$", required=False)
    color = serializers.RegexField(
        r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", required=False
    )
    background_color = serializers.RegexField(
        r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", required=False
    )


class TemplateLogoEmojiSerializer(serializers.Serializer):
    value = serializers.CharField(max_length=100, required=False)


class LogoPropsSerializer(serializers.Serializer):
    in_use = serializers.ChoiceField(choices=["icon", "emoji"], allow_null=True, required=False)
    icon = TemplateLogoIconSerializer(required=False)
    emoji = TemplateLogoEmojiSerializer(required=False)


class PageTemplateConfigurationSerializer(serializers.Serializer):
    logo_props = LogoPropsSerializer(required=False, allow_null=True)


class WorkItemTemplateConfigurationSerializer(serializers.Serializer):
    type_id = serializers.UUIDField(allow_null=True, required=False)
    state_id = serializers.UUIDField(allow_null=True, default=None)
    assignee_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    label_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    module_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    children = WorkItemTemplateChildSerializer(many=True, default=list, max_length=50)
