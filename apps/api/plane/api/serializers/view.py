# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from .base import BaseSerializer
from plane.db.models import IssueView


class IssueViewAPISerializer(BaseSerializer):
    """
    Public API representation of a saved work item view.

    Filters are stored as ``rich_filters``, the JSON filter tree the web app
    uses (e.g. ``{"and": [{"state_group__in": "started"}, {"priority__in": "urgent,high"}]}``).
    """

    class Meta:
        model = IssueView
        fields = [
            "id",
            "name",
            "description",
            "rich_filters",
            "display_filters",
            "display_properties",
            "access",
            "logo_props",
            "is_locked",
            "owned_by",
            "project",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "is_locked",
            "owned_by",
            "project",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate_access(self, value):
        # Note: views use 1 for public and 0 for private (the reverse of pages)
        if value not in (0, 1):
            raise serializers.ValidationError("access must be 1 (public) or 0 (private)")
        return value

    def validate_rich_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("rich_filters must be a JSON object")
        return value
