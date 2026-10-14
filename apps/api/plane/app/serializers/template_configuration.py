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


class WorkItemTemplateConfigurationSerializer(serializers.Serializer):
    state_id = serializers.UUIDField(allow_null=True, default=None)
    assignee_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    label_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    module_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100, default=list)
    children = TemplateChildSerializer(many=True, default=list, max_length=50)
