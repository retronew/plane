# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone
from django.db.models import Q

# Third party imports
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import SAFE_METHODS

# Module imports
from plane.db.models import APIToken, WorkspaceMember


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    Authentication with an API Key
    """

    www_authenticate_realm = "api"
    media_type = "application/json"
    auth_header_name = "X-Api-Key"

    def get_api_token(self, request):
        return request.headers.get(self.auth_header_name)

    def validate_api_token(self, token, request=None, *, workspace_slug=None):
        try:
            api_token = APIToken.objects.get(
                Q(Q(expired_at__gt=timezone.now()) | Q(expired_at__isnull=True)),
                token=token,
                is_active=True,
                user__is_active=True,
            )
        except APIToken.DoesNotExist:
            raise AuthenticationFailed("Given API token is not valid")

        if api_token.workspace_id:
            # HTTP API requests must use their URL scope; transports such as MCP
            # can supply a workspace explicitly when no API request exists yet.
            if request is not None:
                match = getattr(request, "resolver_match", None)
                workspace_slug = match.kwargs.get("slug") if match else None
            if workspace_slug != api_token.workspace.slug:
                raise PermissionDenied("This API token is restricted to its workspace")
            if not WorkspaceMember.objects.filter(
                workspace_id=api_token.workspace_id, member_id=api_token.user_id, role=20, is_active=True
            ).exists():
                raise PermissionDenied("The token issuer is no longer a workspace administrator")

        # save api token last used
        api_token.last_used = timezone.now()
        api_token.save(update_fields=["last_used"])
        # A read-only token may only make safe requests
        if request is not None and api_token.scope == APIToken.SCOPE_READ and request.method not in SAFE_METHODS:
            raise PermissionDenied("This API token is read-only")

        return (api_token.user, api_token.token)

    def authenticate(self, request):
        token = self.get_api_token(request=request)
        if not token:
            return None

        # Validate the API token
        user, token = self.validate_api_token(token, request=request)
        return user, token
