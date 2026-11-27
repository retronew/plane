# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import WorkspaceMember, ProjectMember
from functools import wraps
from rest_framework.response import Response
from rest_framework import status

from enum import Enum


class ROLE(Enum):
    ADMIN = 20
    MEMBER = 15
    GUEST = 5


def get_request_perm_cache(request):
    """Return a per-HTTP-request permission cache dict shared across bootstrap sub-requests."""
    raw = getattr(request, "_request", request)
    cache = getattr(raw, "_perm_cache", None)
    if cache is None:
        cache = {}
        raw._perm_cache = cache
    return cache


def get_cached_workspace_role(request, slug):
    user_id = getattr(request.user, "id", None)
    if not user_id:
        return None
    cache = get_request_perm_cache(request)
    key = ("ws_role", str(user_id), slug)
    if key not in cache:
        cache[key] = (
            WorkspaceMember.objects.filter(
                member=request.user,
                workspace__slug=slug,
                is_active=True,
            )
            .values_list("role", flat=True)
            .first()
        )
    return cache[key]


def get_cached_project_role(request, slug, project_id):
    user_id = getattr(request.user, "id", None)
    if not user_id:
        return None
    cache = get_request_perm_cache(request)
    key = ("proj_role", str(user_id), slug, str(project_id))
    if key not in cache:
        cache[key] = (
            ProjectMember.objects.filter(
                member=request.user,
                workspace__slug=slug,
                project_id=project_id,
                is_active=True,
            )
            .values_list("role", flat=True)
            .first()
        )
    return cache[key]


def allow_permission(allowed_roles, level="PROJECT", creator=False, model=None):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(instance, request, *args, **kwargs):
            slug = kwargs["slug"]
            # Check for creator if required
            if creator and model:
                # check if the user is part of the workspace or not
                if get_cached_workspace_role(request, slug) is None:
                    return Response(
                        {"error": "You don't have the required permissions."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                obj = model.objects.filter(id=kwargs["pk"], created_by=request.user).exists()
                if obj:
                    return view_func(instance, request, *args, **kwargs)

            # Convert allowed_roles to their values if they are enum members
            allowed_role_values = [role.value if isinstance(role, ROLE) else role for role in allowed_roles]

            # Check role permissions
            if level == "WORKSPACE":
                ws_role = get_cached_workspace_role(request, slug)
                if ws_role in allowed_role_values:
                    return view_func(instance, request, *args, **kwargs)
            else:
                project_role = get_cached_project_role(request, slug, kwargs["project_id"])
                if project_role in allowed_role_values:
                    return view_func(instance, request, *args, **kwargs)
                elif project_role is not None and get_cached_workspace_role(request, slug) == ROLE.ADMIN.value:
                    return view_func(instance, request, *args, **kwargs)

            # Return permission denied if no conditions are met
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return _wrapped_view

    return decorator
