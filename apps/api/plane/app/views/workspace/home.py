# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.db.models.workspace import WorkspaceHomePreference
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import Workspace
from plane.app.serializers.workspace import WorkspaceHomePreferenceSerializer

# Third party imports
from rest_framework.response import Response
from rest_framework import status


class WorkspaceHomePreferenceViewSet(BaseAPIView):
    model = WorkspaceHomePreference

    def get_serializer_class(self):
        return WorkspaceHomePreferenceSerializer

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        existing = list(
            WorkspaceHomePreference.objects.filter(user=request.user, workspace__slug=slug).values(
                "key", "is_enabled", "config", "sort_order"
            )
        )
        existing_keys = {row["key"] for row in existing}
        expected_keys = [
            key
            for key, _ in WorkspaceHomePreference.HomeWidgetKeys.choices
            if key not in ["quick_tutorial", "new_at_plane"]
        ]
        missing_keys = [key for key in expected_keys if key not in existing_keys]

        if missing_keys:
            workspace = Workspace.objects.get(slug=slug)
            WorkspaceHomePreference.objects.bulk_create(
                [
                    WorkspaceHomePreference(
                        key=key,
                        user=request.user,
                        workspace=workspace,
                        sort_order=1000 - (idx + 1),
                    )
                    for idx, key in enumerate(missing_keys)
                ],
                batch_size=10,
                ignore_conflicts=True,
            )
            existing = list(
                WorkspaceHomePreference.objects.filter(user=request.user, workspace_id=workspace.id).values(
                    "key", "is_enabled", "config", "sort_order"
                )
            )

        return Response(existing, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def patch(self, request, slug, key):
        preference = WorkspaceHomePreference.objects.filter(key=key, workspace__slug=slug, user=request.user).first()

        if preference:
            serializer = WorkspaceHomePreferenceSerializer(preference, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Preference not found"}, status=status.HTTP_400_BAD_REQUEST)
