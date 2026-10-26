# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.license.api.views import (
    EmailCredentialCheckEndpoint,
    InstanceAdminEndpoint,
    InstanceUserEndpoint,
    InstanceUserDetailEndpoint,
    InstanceUserActivateEndpoint,
    InstanceUserDeactivateEndpoint,
    InstanceAdminOIDCInitiateEndpoint,
    InstanceAdminOIDCCallbackEndpoint,
    InstanceAdminSignInEndpoint,
    InstanceAdminSignUpEndpoint,
    InstanceConfigurationEndpoint,
    DisableEmailFeatureEndpoint,
    InstanceEndpoint,
    SignUpScreenVisitedEndpoint,
    InstanceAdminUserMeEndpoint,
    InstanceAdminSignOutEndpoint,
    InstanceAdminUserSessionEndpoint,
    InstanceWorkSpaceAvailabilityCheckEndpoint,
    InstanceWorkSpaceEndpoint,
    InstanceAIModelsEndpoint,
    InstanceAIProvidersEndpoint,
    InstanceAITestEndpoint,
)

from plane.license.api.views.feishu import (
    InstanceFeishuEndpoint,
    InstanceFeishuCheckEndpoint,
    InstanceFeishuTestEndpoint,
)

urlpatterns = [
    path("feishu/", InstanceFeishuEndpoint.as_view(), name="instance-feishu"),
    path("feishu/check/", InstanceFeishuCheckEndpoint.as_view(), name="instance-feishu-check"),
    path("feishu/test/", InstanceFeishuTestEndpoint.as_view(), name="instance-feishu-test"),
    path("", InstanceEndpoint.as_view(), name="instance"),
    path("admins/", InstanceAdminEndpoint.as_view(), name="instance-admins"),
    path("admins/me/", InstanceAdminUserMeEndpoint.as_view(), name="instance-admins"),
    path(
        "admins/session/",
        InstanceAdminUserSessionEndpoint.as_view(),
        name="instance-admin-session",
    ),
    path(
        "admins/sign-out/",
        InstanceAdminSignOutEndpoint.as_view(),
        name="instance-admins",
    ),
    path("admins/<uuid:pk>/", InstanceAdminEndpoint.as_view(), name="instance-admins"),
    path("users/", InstanceUserEndpoint.as_view(), name="instance-users"),
    path("users/<uuid:pk>/", InstanceUserDetailEndpoint.as_view(), name="instance-user-detail"),
    path(
        "users/<uuid:pk>/deactivate/",
        InstanceUserDeactivateEndpoint.as_view(),
        name="instance-user-deactivate",
    ),
    path("users/<uuid:pk>/activate/", InstanceUserActivateEndpoint.as_view(), name="instance-user-activate"),
    path("admins/oidc/", InstanceAdminOIDCInitiateEndpoint.as_view(), name="instance-admin-oidc"),
    path(
        "admins/oidc/callback/",
        InstanceAdminOIDCCallbackEndpoint.as_view(),
        name="instance-admin-oidc-callback",
    ),
    path(
        "configurations/",
        InstanceConfigurationEndpoint.as_view(),
        name="instance-configuration",
    ),
    path(
        "configurations/disable-email-feature/",
        DisableEmailFeatureEndpoint.as_view(),
        name="disable-email-configuration",
    ),
    path(
        "admins/sign-in/",
        InstanceAdminSignInEndpoint.as_view(),
        name="instance-admin-sign-in",
    ),
    path(
        "admins/sign-up/",
        InstanceAdminSignUpEndpoint.as_view(),
        name="instance-admin-sign-in",
    ),
    path(
        "admins/sign-up-screen-visited/",
        SignUpScreenVisitedEndpoint.as_view(),
        name="instance-sign-up",
    ),
    path(
        "email-credentials-check/",
        EmailCredentialCheckEndpoint.as_view(),
        name="email-credential-check",
    ),
    path(
        "workspace-slug-check/",
        InstanceWorkSpaceAvailabilityCheckEndpoint.as_view(),
        name="instance-workspace-availability",
    ),
    path("ai/providers/", InstanceAIProvidersEndpoint.as_view(), name="instance-ai-providers"),
    path("ai/models/", InstanceAIModelsEndpoint.as_view(), name="instance-ai-models"),
    path("ai/test/", InstanceAITestEndpoint.as_view(), name="instance-ai-test"),
    path("workspaces/", InstanceWorkSpaceEndpoint.as_view(), name="instance-workspace"),
]
