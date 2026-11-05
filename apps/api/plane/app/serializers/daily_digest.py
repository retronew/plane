"""Strict PATCH contract for personal daily digests."""

from rest_framework import serializers

from plane.db.models import DailyDigestConfig
from plane.services.daily_digest import CONFIG_FIELDS, MODULES, accessible_projects, accessible_workspaces
from plane.utils.notification_preferences import CHANNELS


class DailyDigestConfigSerializer(serializers.ModelSerializer):
    send_time = serializers.RegexField(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    channels = serializers.ListField(child=serializers.ChoiceField(choices=CHANNELS), max_length=3)
    modules = serializers.ListField(child=serializers.ChoiceField(choices=MODULES), max_length=6)
    workspace_ids = serializers.ListField(child=serializers.UUIDField(), max_length=1000)
    project_ids = serializers.ListField(child=serializers.UUIDField(), max_length=1000)
    due_soon_days = serializers.IntegerField(min_value=1, max_value=30)

    class Meta:
        model = DailyDigestConfig
        fields = CONFIG_FIELDS

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected a JSON object.")
        unknown = set(data) - set(CONFIG_FIELDS)
        if unknown:
            raise serializers.ValidationError({key: "Unknown or read-only field." for key in unknown})
        # DRF normally coerces strings/numbers to bool; this JSON contract is strict.
        for key in ("enabled", "weekdays_only", "include_details", "send_empty"):
            if key in data and not isinstance(data[key], bool):
                raise serializers.ValidationError({key: "Expected a boolean."})
        for key in ("workspace_ids", "project_ids", "channels", "modules"):
            if key in data and (not isinstance(data[key], list) or any(not isinstance(v, str) for v in data[key])):
                raise serializers.ValidationError({key: "Expected an array of strings."})
        if "due_soon_days" in data and type(data["due_soon_days"]) is not int:
            raise serializers.ValidationError({"due_soon_days": "Expected an integer."})
        return super().to_internal_value(data)

    def validate(self, attrs):
        user = self.context["user"]
        for key in ("workspace_ids", "project_ids", "channels", "modules"):
            if key in attrs:
                values = [str(value) for value in attrs[key]]
                if len(set(values)) != len(values):
                    raise serializers.ValidationError({key: "Duplicate values are not allowed."})
                attrs[key] = values
        for key, queryset, field in (
            ("workspace_ids", accessible_workspaces(user), "workspace_id"),
            ("project_ids", accessible_projects(user), "project_id"),
        ):
            if key in attrs and set(attrs[key]) - {str(value) for value in queryset.values_list(field, flat=True)}:
                raise serializers.ValidationError({key: "Contains inaccessible or inactive scopes."})
        enabled = attrs.get("enabled", self.instance.enabled)
        for key in ("channels", "modules"):
            if enabled and not attrs.get(key, getattr(self.instance, key)):
                raise serializers.ValidationError({key: "Select at least one value when enabled."})
        return attrs
