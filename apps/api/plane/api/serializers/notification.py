# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from .base import BaseSerializer
from plane.db.models import Notification


class NotificationAPISerializer(BaseSerializer):
    """A notification the requesting user received, with its sender kept to id and name."""

    triggered_by_name = serializers.CharField(source="triggered_by.display_name", read_only=True, default=None)
    is_mentioned = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message_stripped",
            "data",
            "entity_name",
            "entity_identifier",
            "project",
            "sender",
            "is_mentioned",
            "triggered_by",
            "triggered_by_name",
            "read_at",
            "snoozed_till",
            "archived_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_mentioned(self, obj) -> bool:
        return "mentioned" in (obj.sender or "")
