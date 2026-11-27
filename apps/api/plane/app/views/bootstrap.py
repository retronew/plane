# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import logging

from django.http import HttpRequest, QueryDict
from django.urls import resolve
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from plane.app.permissions import ROLE
from plane.app.permissions.base import get_request_perm_cache
from plane.db.models import WorkspaceMember

from .base import BaseAPIView

logger = logging.getLogger(__name__)


def _invoke_sub_get(request, path: str, query_string: str = ""):
    """Dispatch an internal GET request to an existing Plane API endpoint.

    Preserves the exact authenticated user/session and original URL path so
    all existing permissions, serializers, and Redis `@cache_response` keys
    are reused identically without duplicating business logic.
    """
    raw = getattr(request, "_request", request)
    try:
        match = resolve(path)
    except Exception:
        logger.warning("Bootstrap sub-route failed to resolve: %s", path)
        return None

    sub = HttpRequest()
    sub.method = "GET"
    sub.path = path
    sub.path_info = path
    sub.META = {
        k: v
        for k, v in raw.META.items()
        if k not in ("CONTENT_LENGTH", "CONTENT_TYPE", "wsgi.input")
    }
    sub.META["REQUEST_METHOD"] = "GET"
    sub.META["PATH_INFO"] = path
    sub.META["QUERY_STRING"] = query_string
    sub.GET = QueryDict(query_string)
    sub.COOKIES = raw.COOKIES
    sub.user = request.user
    if hasattr(raw, "session"):
        sub.session = raw.session
    if hasattr(raw, "_cached_user"):
        sub._cached_user = raw._cached_user
    if hasattr(request, "auth"):
        sub.auth = request.auth
    # Share per-request permission cache across bootstrap sub-requests so @allow_permission
    # does not repeat the same WorkspaceMember / ProjectMember lookup 8-10 times.
    sub._perm_cache = get_request_perm_cache(request)
    # Bypass DRF CSRF enforcement on internal GET sub-requests
    sub._dont_enforce_csrf_checks = True

    try:
        response = match.func(sub, *match.args, **match.kwargs)
    except Exception:
        logger.exception("Bootstrap sub-request failed for %s", path)
        return None

    if 200 <= response.status_code < 300:
        if hasattr(response, "data"):
            return response.data
        content = getattr(response, "content", b"")
        if not content:
            return None
        try:
            return json.loads(content)
        except ValueError:
            return None
    return None


class AppBootstrapEndpoint(BaseAPIView):
    """Aggregate global app bootstrap payload (6 requests -> 1)."""

    permission_classes = [AllowAny]

    def get(self, request):
        instance = _invoke_sub_get(request, "/api/instances/")
        is_authenticated = bool(getattr(request.user, "is_authenticated", False))
        if not is_authenticated:
            return Response(
                {
                    "authenticated": False,
                    "instance": instance,
                    "user": None,
                    "profile": None,
                    "settings": None,
                    "workspaces": None,
                    "instance_admin": None,
                    "invitations": None,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "authenticated": True,
                "instance": instance,
                "user": _invoke_sub_get(request, "/api/users/me/"),
                "profile": _invoke_sub_get(request, "/api/users/me/profile/"),
                "settings": _invoke_sub_get(request, "/api/users/me/settings/"),
                "workspaces": _invoke_sub_get(request, "/api/users/me/workspaces/"),
                "instance_admin": _invoke_sub_get(request, "/api/users/me/instance-admin/"),
                "invitations": _invoke_sub_get(request, "/api/users/me/workspaces/invitations/"),
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceBootstrapEndpoint(BaseAPIView):
    """Aggregate workspace shell bootstrap payload (10 requests -> 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        workspace_member = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
        ).first()
        if not workspace_member:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_request_perm_cache(request)[("ws_role", str(request.user.id), slug)] = workspace_member.role

        projects_mode = "full" if request.GET.get("projects") == "full" else "partial"
        projects_path = (
            f"/api/workspaces/{slug}/projects/details/"
            if projects_mode == "full"
            else f"/api/workspaces/{slug}/projects/"
        )

        can_fetch_favorites = workspace_member.role in (ROLE.ADMIN.value, ROLE.MEMBER.value)

        return Response(
            {
                "workspace_member_me": _invoke_sub_get(request, f"/api/workspaces/{slug}/workspace-members/me/"),
                "project_roles": _invoke_sub_get(request, f"/api/users/me/workspaces/{slug}/project-roles/"),
                "projects_mode": projects_mode,
                "projects": _invoke_sub_get(request, projects_path),
                "members": _invoke_sub_get(request, f"/api/workspaces/{slug}/members/"),
                "favorites": (
                    _invoke_sub_get(request, f"/api/workspaces/{slug}/user-favorites/", "all=true")
                    if can_fetch_favorites
                    else None
                ),
                "states": _invoke_sub_get(request, f"/api/workspaces/{slug}/states/"),
                "sidebar_preferences": _invoke_sub_get(request, f"/api/workspaces/{slug}/sidebar-preferences/"),
                "user_properties": _invoke_sub_get(request, f"/api/workspaces/{slug}/user-properties/"),
                "unread_notifications": _invoke_sub_get(
                    request, f"/api/workspaces/{slug}/users/notifications/unread/"
                ),
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceHomeBootstrapEndpoint(BaseAPIView):
    """Aggregate Home dashboard widgets payload (4 requests across 2 serial hops -> 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        workspace_member = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
        ).first()
        if not workspace_member:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_request_perm_cache(request)[("ws_role", str(request.user.id), slug)] = workspace_member.role

        return Response(
            {
                "home_preferences": _invoke_sub_get(request, f"/api/workspaces/{slug}/home-preferences/"),
                "quick_links": _invoke_sub_get(request, f"/api/workspaces/{slug}/quick-links/"),
                "recent_visits": _invoke_sub_get(request, f"/api/workspaces/{slug}/recent-visits/"),
                "stickies": _invoke_sub_get(request, f"/api/workspaces/{slug}/stickies/", "cursor=30:0:0&per_page=30"),
            },
            status=status.HTTP_200_OK,
        )


class WorkItemBootstrapEndpoint(BaseAPIView):
    """Aggregate work-item detail bootstrap payload (7 requests across 2 serial hops -> 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug, identifier):
        workspace_member = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
        ).first()
        if not workspace_member:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_request_perm_cache(request)[("ws_role", str(request.user.id), slug)] = workspace_member.role

        issue = _invoke_sub_get(
            request,
            f"/api/workspaces/{slug}/work-items/{identifier}/",
            "expand=issue_reactions,issue_attachments,issue_link,parent",
        )
        if not issue or not isinstance(issue, dict) or not issue.get("id") or not issue.get("project_id"):
            return Response({"error": "Issue does not exist"}, status=status.HTTP_404_NOT_FOUND)

        project_id = issue["project_id"]
        issue_id = issue["id"]
        is_intake_or_archived = bool(issue.get("is_intake") or issue.get("archived_at"))

        payload = {
            "issue": issue,
            "activities": None,
            "comments": None,
            "relations": None,
            "sub_issues": None,
            "collaboration": None,
            "description_versions": None,
        }

        if not is_intake_or_archived:
            base = f"/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}"
            payload["activities"] = _invoke_sub_get(request, f"{base}/history/", "activity_type=issue-property")
            payload["comments"] = _invoke_sub_get(request, f"{base}/history/", "activity_type=issue-comment")
            payload["relations"] = _invoke_sub_get(request, f"{base}/issue-relation/")
            if (issue.get("sub_issues_count") or 0) > 0:
                payload["sub_issues"] = _invoke_sub_get(request, f"{base}/sub-issues/")
            payload["collaboration"] = _invoke_sub_get(request, f"{base}/collaboration/")
            payload["description_versions"] = _invoke_sub_get(
                request,
                f"/api/workspaces/{slug}/projects/{project_id}/work-items/{issue_id}/description-versions/",
            )

        return Response(payload, status=status.HTTP_200_OK)


class WorkspaceViewBootstrapEndpoint(BaseAPIView):
    """Aggregate workspace global view metadata (5 requests -> 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        workspace_member = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
        ).first()
        if not workspace_member:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_request_perm_cache(request)[("ws_role", str(request.user.id), slug)] = workspace_member.role

        return Response(
            {
                "views": _invoke_sub_get(request, f"/api/workspaces/{slug}/views/"),
                "modules": _invoke_sub_get(request, f"/api/workspaces/{slug}/modules/"),
                "cycles": _invoke_sub_get(request, f"/api/workspaces/{slug}/cycles/"),
                "labels": _invoke_sub_get(request, f"/api/workspaces/{slug}/labels/"),
                "estimates": _invoke_sub_get(request, f"/api/workspaces/{slug}/estimates/"),
            },
            status=status.HTTP_200_OK,
        )


class ProjectBootstrapEndpoint(BaseAPIView):
    """Aggregate project shell metadata (6-9 requests -> 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug, project_id):
        workspace_member = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            is_active=True,
        ).first()
        if not workspace_member:
            return Response(
                {"error": "You don't have the required permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        get_request_perm_cache(request)[("ws_role", str(request.user.id), slug)] = workspace_member.role

        include_raw = request.GET.get("include", "")
        include = {part.strip() for part in include_raw.split(",") if part.strip()}

        project_data = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/")
        member_me = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/project-members/me/")

        payload = {
            "project": project_data,
            "project_member_me": member_me,
            "states": None,
            "labels": None,
            "members": None,
            "user_properties": None,
            "cycles": None,
            "modules": None,
            "views": None,
            "estimates": None,
        }

        if member_me is not None:
            if not include or "states" in include or "core" in include:
                payload["states"] = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/states/")
            if not include or "labels" in include or "core" in include:
                payload["labels"] = _invoke_sub_get(
                    request, f"/api/workspaces/{slug}/projects/{project_id}/issue-labels/"
                )
            if not include or "members" in include or "core" in include:
                payload["members"] = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/members/")
            if "user_properties" in include:
                payload["user_properties"] = _invoke_sub_get(
                    request, f"/api/workspaces/{slug}/projects/{project_id}/user-properties/"
                )
            if "cycles" in include and (not project_data or project_data.get("cycle_view")):
                payload["cycles"] = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/cycles/")
            if "modules" in include and (not project_data or project_data.get("module_view")):
                payload["modules"] = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/modules/")
            if "views" in include and (not project_data or project_data.get("issue_views_view")):
                payload["views"] = _invoke_sub_get(request, f"/api/workspaces/{slug}/projects/{project_id}/views/")
            if "estimates" in include and project_data and project_data.get("estimate"):
                payload["estimates"] = _invoke_sub_get(
                    request, f"/api/workspaces/{slug}/projects/{project_id}/estimates/"
                )

        return Response(payload, status=status.HTTP_200_OK)
