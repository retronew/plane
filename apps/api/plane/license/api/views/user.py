# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""God mode user management: list every user and (de)activate accounts."""

# Django imports
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

# Third party imports
from rest_framework import serializers, status
from rest_framework.response import Response

# Module imports
from plane.authentication.utils.host import user_ip
from plane.db.models import Account, Session, User, WorkspaceMember
from plane.utils.url import contains_url
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.models import InstanceAdmin

from .base import BaseAPIView

USER_STATUSES = ("active", "deactivated")
USER_ACCOUNT_TYPES = ("user", "admin")


def _user_queryset():
    return (
        User.objects.filter(is_bot=False)
        .annotate(
            is_instance_admin=Exists(InstanceAdmin.objects.filter(user=OuterRef("pk"))),
            has_sso=Exists(Account.objects.filter(user=OuterRef("pk"), provider="oidc")),
            workspace_count=Count(
                "member_workspace",
                filter=Q(
                    member_workspace__is_active=True,
                    member_workspace__deleted_at__isnull=True,
                    member_workspace__workspace__deleted_at__isnull=True,
                ),
                distinct=True,
            ),
        )
        .order_by("-date_joined", "id")
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


class InstanceUserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    display_name = serializers.CharField(required=False, allow_blank=False, max_length=255)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            errors = {key: ["Unknown field."] for key in data if key not in self.fields}
            for key in self.fields:
                if key in data and not isinstance(data[key], str):
                    errors[key] = ["Must be a string."]
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def validate_first_name(self, value):
        if contains_url(value):
            raise serializers.ValidationError("First name cannot contain a URL.")
        return value

    def validate_last_name(self, value):
        if contains_url(value):
            raise serializers.ValidationError("Last name cannot contain a URL.")
        return value


def serialize_user_detail(user):
    memberships = (
        WorkspaceMember.objects.filter(
            member=user, is_active=True, deleted_at__isnull=True, workspace__deleted_at__isnull=True
        )
        .select_related("workspace")
        .order_by("workspace__name", "workspace_id")
    )
    return {
        **serialize_user(user),
        "workspaces": [
            {
                "id": str(membership.workspace_id),
                "name": membership.workspace.name,
                "slug": membership.workspace.slug,
                "role": membership.role,
            }
            for membership in memberships
        ],
    }


class InstanceUserDetailEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request, pk):
        user = _user_queryset().filter(pk=pk).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_user_detail(user))

    def patch(self, request, pk):
        user = _user_queryset().filter(pk=pk).first()
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = InstanceUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        if serializer.validated_data:
            user.save(update_fields=[*serializer.validated_data, "updated_at"])
        return Response(serialize_user_detail(user))


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

        account_type = request.query_params.get("account_type")
        if account_type in USER_ACCOUNT_TYPES:
            users = users.filter(is_instance_admin=account_type == "admin")

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
