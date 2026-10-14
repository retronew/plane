# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""God mode user management: list every user and (de)activate accounts."""

# Django imports
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.authentication.utils.host import user_ip
from plane.db.models import Account, Session, User
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.models import InstanceAdmin

from .base import BaseAPIView

USER_STATUSES = ("active", "deactivated")


def _user_queryset():
    return (
        User.objects.filter(is_bot=False)
        .annotate(
            is_instance_admin=Exists(InstanceAdmin.objects.filter(user=OuterRef("pk"))),
            has_sso=Exists(Account.objects.filter(user=OuterRef("pk"), provider="oidc")),
            workspace_count=Count(
                "member_workspace",
                filter=Q(member_workspace__is_active=True, member_workspace__deleted_at__isnull=True),
                distinct=True,
            ),
        )
        .order_by("-is_active", "first_name", "email")
    )


def serialize_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_instance_admin": user.is_instance_admin,
        "has_sso": user.has_sso,
        "last_login_medium": user.last_login_medium,
        "last_login_time": user.last_login_time,
        "workspace_count": user.workspace_count,
        "date_joined": user.date_joined,
    }


class InstanceUserEndpoint(BaseAPIView):
    """Paginated list of all (non-bot) users, searchable by name or email."""

    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        users = _user_queryset()

        search = str(request.query_params.get("search") or "").strip()
        if search:
            users = users.filter(
                Q(email__icontains=search)
                | Q(display_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        user_status = request.query_params.get("status")
        if user_status in USER_STATUSES:
            users = users.filter(is_active=user_status == "active")

        return self.paginate(
            request=request,
            queryset=users,
            on_results=lambda results: [serialize_user(user) for user in results],
            max_per_page=100,
            default_per_page=50,
        )


class InstanceUserDeactivateEndpoint(BaseAPIView):
    """Deactivate an account: it can no longer sign in (password, SSO or API
    token) and every open session is ended. Workspace memberships are kept so
    reactivating restores the user as they were."""

    permission_classes = [InstanceAdminPermission]

    def post(self, request, pk):
        user = User.objects.filter(pk=pk, is_bot=False).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response(
                {"error": "You cannot deactivate yourself", "error_code": "CANNOT_DEACTIVATE_SELF"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Admins keep God mode access; revoke it first so an admin is never locked out by accident
        if InstanceAdmin.objects.filter(user=user).exists():
            return Response(
                {"error": "Remove admin access before deactivating", "error_code": "USER_IS_ADMIN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        # A logout time marks the account as deactivated on purpose, which also
        # blocks reactivation through an OIDC sign-in (see Adapter.complete_login_or_signup)
        user.last_logout_time = timezone.now()
        user.last_logout_ip = user_ip(request=request)
        user.save(update_fields=["is_active", "last_logout_time", "last_logout_ip"])
        Session.objects.filter(user_id=str(user.id)).delete()

        return Response(serialize_user(_user_queryset().get(pk=user.pk)), status=status.HTTP_200_OK)


class InstanceUserActivateEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request, pk):
        user = User.objects.filter(pk=pk, is_bot=False).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return Response(serialize_user(_user_queryset().get(pk=user.pk)), status=status.HTTP_200_OK)
