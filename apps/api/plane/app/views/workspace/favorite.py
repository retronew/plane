# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from collections import defaultdict

# Third party modules
from rest_framework import status
from rest_framework.response import Response

# Django modules
from django.db.models import Q
from django.db import IntegrityError

# Module imports
from plane.app.views.base import BaseAPIView
from plane.db.models import UserFavorite, Workspace
from plane.app.serializers import UserFavoriteSerializer
from plane.app.serializers.favorite import get_entity_model_and_serializer
from plane.app.permissions import allow_permission, ROLE
from plane.utils.cache import cache_response, invalidate_cache


def _build_favorite_entity_map(favorites):
    """Batch-fetch favorite target entities grouped by type to avoid N+1 queries."""
    ids_by_type = defaultdict(set)
    for fav in favorites:
        if fav.entity_identifier:
            ids_by_type[fav.entity_type].add(fav.entity_identifier)

    entity_map = {}
    for entity_type, ids in ids_by_type.items():
        entity_model, entity_serializer = get_entity_model_and_serializer(entity_type)
        if not entity_model or not entity_serializer or not ids:
            continue
        qs = entity_model.objects.filter(pk__in=ids)
        if entity_type == "page":
            qs = qs.prefetch_related("projects")
        for entity_id, entity in qs.in_bulk().items():
            entity_map[(entity_type, entity_id)] = entity
    return entity_map


class WorkspaceFavoriteEndpoint(BaseAPIView):
    use_read_replica = True

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    @cache_response(60 * 5, user=True)
    def get(self, request, slug):
        # the second filter is to check if the user is a member of the project
        favorites = list(
            UserFavorite.objects.filter(user=request.user, workspace__slug=slug, parent__isnull=True).filter(
                Q(project__isnull=True) & ~Q(entity_type="page")
                | (
                    Q(project__isnull=False)
                    & Q(project__project_projectmember__member=request.user)
                    & Q(project__project_projectmember__is_active=True)
                )
            )
        )
        entity_map = _build_favorite_entity_map(favorites)
        serializer = UserFavoriteSerializer(favorites, many=True, context={"entity_map": entity_map})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    @invalidate_cache(path="/api/workspaces/:slug/user-favorites/", url_params=True, user=True, multiple=True)
    def post(self, request, slug):
        try:
            workspace = Workspace.objects.get(slug=slug)

            # If the favorite exists return
            if request.data.get("entity_identifier"):
                user_favorites = UserFavorite.objects.filter(
                    workspace=workspace,
                    user_id=request.user.id,
                    entity_type=request.data.get("entity_type"),
                    entity_identifier=request.data.get("entity_identifier"),
                ).first()

                # If the favorite exists return
                if user_favorites:
                    serializer = UserFavoriteSerializer(user_favorites)
                    return Response(serializer.data, status=status.HTTP_200_OK)

            # else create a new favorite
            serializer = UserFavoriteSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(
                    user_id=request.user.id,
                    workspace=workspace,
                    project_id=request.data.get("project_id", None),
                )
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response({"error": "Favorite already exists"}, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    @invalidate_cache(path="/api/workspaces/:slug/user-favorites/", url_params=True, user=True, multiple=True)
    def patch(self, request, slug, favorite_id):
        favorite = UserFavorite.objects.get(user=request.user, workspace__slug=slug, pk=favorite_id)
        serializer = UserFavoriteSerializer(favorite, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    @invalidate_cache(path="/api/workspaces/:slug/user-favorites/", url_params=True, user=True, multiple=True)
    def delete(self, request, slug, favorite_id):
        favorite = UserFavorite.objects.get(user=request.user, workspace__slug=slug, pk=favorite_id)
        favorite.delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceFavoriteGroupEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, favorite_id):
        favorites = list(
            UserFavorite.objects.filter(user=request.user, workspace__slug=slug, parent_id=favorite_id).filter(
                Q(project__isnull=True)
                | (
                    Q(project__isnull=False)
                    & Q(project__project_projectmember__member=request.user)
                    & Q(project__project_projectmember__is_active=True)
                )
            )
        )
        entity_map = _build_favorite_entity_map(favorites)
        serializer = UserFavoriteSerializer(favorites, many=True, context={"entity_map": entity_map})
        return Response(serializer.data, status=status.HTTP_200_OK)
