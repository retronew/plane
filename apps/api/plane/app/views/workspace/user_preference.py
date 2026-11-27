# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.db.models.workspace import WorkspaceUserPreference
from plane.app.serializers.workspace import WorkspaceUserPreferenceSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import Workspace
from plane.utils.cache import cache_response, invalidate_cache


# Third party imports
from rest_framework.response import Response
from rest_framework import status

DEFAULT_PINNED_KEYS = frozenset(
    [
        WorkspaceUserPreference.UserPreferenceKeys.DRAFTS,
        WorkspaceUserPreference.UserPreferenceKeys.YOUR_WORK,
        WorkspaceUserPreference.UserPreferenceKeys.STICKIES,
        WorkspaceUserPreference.UserPreferenceKeys.ACTIVE_CYCLES,
    ]
)


class WorkspaceUserPreferenceViewSet(BaseAPIView):
    model = WorkspaceUserPreference
    use_read_replica = True

    def get_serializer_class(self):
        return WorkspaceUserPreferenceSerializer

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    @cache_response(60 * 10, user=True)
    def get(self, request, slug):
        preferences = list(
            WorkspaceUserPreference.objects.filter(user=request.user, workspace__slug=slug)
            .order_by("sort_order")
            .values("key", "is_pinned", "sort_order")
        )

        keys = [key for key, _ in WorkspaceUserPreference.UserPreferenceKeys.choices]
        existing_keys = {pref["key"] for pref in preferences}
        missing_keys = [key for key in keys if key not in existing_keys]

        if missing_keys:
            workspace = Workspace.objects.only("id").get(slug=slug)
            WorkspaceUserPreference.objects.bulk_create(
                [
                    WorkspaceUserPreference(
                        key=key,
                        user=request.user,
                        workspace=workspace,
                        sort_order=(65535 + (i * 10000)),
                        is_pinned=(key in DEFAULT_PINNED_KEYS),
                    )
                    for i, key in enumerate(missing_keys)
                ],
                batch_size=10,
                ignore_conflicts=True,
            )
            preferences = list(
                WorkspaceUserPreference.objects.filter(user=request.user, workspace_id=workspace.id)
                .order_by("sort_order")
                .values("key", "is_pinned", "sort_order")
            )

        user_preferences = {
            str(preference["key"]): {
                "is_pinned": preference["is_pinned"],
                "sort_order": preference["sort_order"],
            }
            for preference in preferences
        }
        return Response(
            user_preferences,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    @invalidate_cache(path="/api/workspaces/:slug/sidebar-preferences/", url_params=True, user=True, multiple=True)
    def patch(self, request, slug):
        for data in request.data:
            key = data.pop("key", None)
            if not key:
                continue

            preference = WorkspaceUserPreference.objects.filter(
                key=key, workspace__slug=slug, user=request.user
            ).first()

            if not preference:
                continue

            if "is_pinned" in data:
                preference.is_pinned = data["is_pinned"]

            if "sort_order" in data:
                preference.sort_order = data["sort_order"]

            preference.save(update_fields=["is_pinned", "sort_order"])

        return Response({"message": "Successfully updated"}, status=status.HTTP_200_OK)
