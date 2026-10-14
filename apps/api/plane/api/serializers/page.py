# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from .base import BaseSerializer
from plane.db.models import Page
from plane.utils.content_validator import validate_html_content


class PageAPISerializer(BaseSerializer):
    """
    Public API representation of a project page.

    The body is exchanged as ``description_html`` only. The collaborative
    (Yjs) binary is owned by the live server, so it is never exposed here and
    is cleared whenever the HTML changes; the live server rebuilds it from the
    HTML the next time the page is opened.
    """

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "owned_by",
            "access",
            "color",
            "parent",
            "is_locked",
            "archived_at",
            "logo_props",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "owned_by",
            "is_locked",
            "archived_at",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate_access(self, value):
        if value not in (Page.PUBLIC_ACCESS, Page.PRIVATE_ACCESS):
            raise serializers.ValidationError("access must be 0 (public) or 1 (private)")
        return value

    def validate_description_html(self, value):
        if not value:
            return "<p></p>"
        is_valid, _, sanitized_html = validate_html_content(value)
        if not is_valid:
            raise serializers.ValidationError("html content is not valid")
        return sanitized_html if sanitized_html is not None else value

    def validate_parent(self, value):
        if value is None:
            return value
        project_id = self.context.get("project_id")
        if not Page.objects.filter(
            pk=value.pk,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
        ).exists():
            raise serializers.ValidationError("Parent page must belong to the same project")
        if self.instance is not None and value.pk == self.instance.pk:
            raise serializers.ValidationError("A page cannot be its own parent")
        return value
