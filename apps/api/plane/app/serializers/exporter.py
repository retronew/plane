# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import reverse
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import ExporterHistory
from .user import UserLiteSerializer


class ExporterHistorySerializer(BaseSerializer):
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        request = self.context.get("request")
        if request and obj.status == "completed" and obj.key:
            # Stream through the authenticated API; storage endpoints may be Docker-only hosts.
            path = reverse("export-issues-download", kwargs={"slug": obj.workspace.slug, "pk": obj.pk})
            return request.build_absolute_uri(path)
        return obj.url

    initiated_by_detail = UserLiteSerializer(source="initiated_by", read_only=True)

    class Meta:
        model = ExporterHistory
        fields = [
            "id",
            "created_at",
            "updated_at",
            "project",
            "provider",
            "status",
            "url",
            "initiated_by",
            "initiated_by_detail",
            "token",
            "created_by",
            "updated_by",
        ]
        read_only_fields = fields
