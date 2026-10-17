# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from collections.abc import Mapping

from django.core.validators import URLValidator
from django.db.models import Count, Q
from rest_framework import serializers

from plane.db.models import (
    Issue,
    ProjectActivity,
    ProjectLink,
    ProjectReaction,
    ProjectUpdate,
    ProjectUpdateComment,
    ProjectUpdateReaction,
)

from .base import BaseSerializer
from .user import UserLiteSerializer


class EditableFieldsOnlyMixin:
    """Never accept parent, ownership or audit fields from resource payloads."""

    editable_fields = frozenset()

    def create(self, validated_data):
        instance = self.Meta.model(**validated_data)
        instance.save(disable_auto_set_user=True)
        return instance

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(disable_auto_set_user=True)
        return instance

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            invalid = set(data) - self.editable_fields
            if invalid:
                raise serializers.ValidationError({key: "This field is not editable." for key in sorted(invalid)})
        return super().to_internal_value(data)


RESOURCE_FIELDS = ["id", "project", "workspace", "created_at", "updated_at", "created_by", "updated_by"]


class ProjectLinkSerializer(EditableFieldsOnlyMixin, BaseSerializer):
    editable_fields = frozenset({"title", "url"})
    title = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")
    url = serializers.URLField(max_length=2048, validators=[URLValidator(schemes=["http", "https"])])
    created_by_detail = UserLiteSerializer(source="created_by", read_only=True)

    class Meta:
        model = ProjectLink
        fields = [*RESOURCE_FIELDS, "title", "url", "created_by_detail"]
        read_only_fields = RESOURCE_FIELDS


def validate_project_reaction(value):
    """Accept emoji or the decimal Unicode sequence used by the issue picker."""
    if not isinstance(value, str) or not value or len(value) > 64:
        raise serializers.ValidationError("Provide an emoji or decimal emoji code of at most 64 characters.")
    decoded = value
    if re.fullmatch(r"[0-9]+(?:-[0-9]+)*", value):
        try:
            decoded = "".join(chr(int(part)) for part in value.split("-"))
        except (ValueError, OverflowError):
            raise serializers.ValidationError("Invalid emoji code.")
    has_emoji = False
    for char in decoded:
        code = ord(char)
        if (
            0x1F000 <= code <= 0x1FAFF
            or 0x2600 <= code <= 0x27BF
            or code
            in {0x00A9, 0x00AE, 0x203C, 0x2049, 0x2122, 0x2139, 0x2328, 0x23CF, 0x24C2, 0x3030, 0x303D, 0x3297, 0x3299}
            or 0x2194 <= code <= 0x21AA
            or 0x231A <= code <= 0x231B
            or 0x23E9 <= code <= 0x23F3
            or 0x23F8 <= code <= 0x23FA
            or 0x25AA <= code <= 0x25AB
            or code
            in {
                0x25B6,
                0x25C0,
                0x25FB,
                0x25FC,
                0x25FD,
                0x25FE,
                0x2934,
                0x2935,
                0x2B05,
                0x2B06,
                0x2B07,
                0x2B1B,
                0x2B1C,
                0x2B50,
                0x2B55,
            }
        ):
            has_emoji = True
        elif code in {0x200D, 0xFE0F, 0x20E3} or 0xE0020 <= code <= 0xE007F:
            continue
        elif char in "0123456789#*" and "⃣" in decoded:
            has_emoji = True
        else:
            raise serializers.ValidationError("Provide a valid emoji or decimal emoji code.")
    if not has_emoji:
        raise serializers.ValidationError("Provide a valid emoji or decimal emoji code.")
    return value


class ProjectReactionSerializer(EditableFieldsOnlyMixin, BaseSerializer):
    editable_fields = frozenset({"reaction"})
    reaction = serializers.CharField(max_length=64, trim_whitespace=False, validators=[validate_project_reaction])
    actor_detail = UserLiteSerializer(source="actor", read_only=True)

    def to_internal_value(self, data):
        if isinstance(data, Mapping) and "reaction" in data and not isinstance(data["reaction"], str):
            raise serializers.ValidationError({"reaction": "Provide an emoji string."})
        return super().to_internal_value(data)

    class Meta:
        model = ProjectReaction
        fields = [*RESOURCE_FIELDS, "reaction", "actor", "actor_detail"]
        read_only_fields = [*RESOURCE_FIELDS, "actor"]
        # Idempotence is handled under the project's write lock, not by input validation.
        validators = []


class ProjectUpdateReactionSerializer(ProjectReactionSerializer):
    class Meta(ProjectReactionSerializer.Meta):
        model = ProjectUpdateReaction


def get_project_update_progress(project):
    return (
        Issue.issue_objects.filter(project=project, workspace_id=project.workspace_id)
        .exclude(state__group="cancelled")
        .aggregate(completed=Count("id", filter=Q(state__group="completed")), total=Count("id"))
    )


class ProjectUpdateSerializer(EditableFieldsOnlyMixin, BaseSerializer):
    editable_fields = frozenset({"body", "health"})
    body = serializers.CharField(max_length=100000)
    created_by_detail = UserLiteSerializer(source="created_by", read_only=True)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    reactions = ProjectUpdateReactionSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()
    progress_source = serializers.SerializerMethodField()

    def get_progress(self, instance):
        return instance.progress if instance.progress is not None else self.context.get("current_progress")

    def get_progress_source(self, instance):
        return "snapshot" if instance.progress is not None else "current"

    def create(self, validated_data):
        validated_data["progress"] = get_project_update_progress(validated_data["project"])
        return super().create(validated_data)

    class Meta:
        model = ProjectUpdate
        fields = [
            *RESOURCE_FIELDS,
            "body",
            "health",
            "created_by_detail",
            "progress",
            "progress_source",
            "comment_count",
            "reactions",
        ]
        read_only_fields = [*RESOURCE_FIELDS, "progress"]


class ProjectUpdateCommentSerializer(EditableFieldsOnlyMixin, BaseSerializer):
    editable_fields = frozenset({"body"})
    body = serializers.CharField(max_length=100000)
    created_by_detail = UserLiteSerializer(source="created_by", read_only=True)

    class Meta:
        model = ProjectUpdateComment
        fields = ["id", "body", "created_by", "created_by_detail", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class ProjectActivitySerializer(BaseSerializer):
    actor_detail = UserLiteSerializer(source="actor", read_only=True)

    class Meta:
        model = ProjectActivity
        fields = [*RESOURCE_FIELDS, "verb", "field", "old_value", "new_value", "actor", "actor_detail"]
        read_only_fields = fields
