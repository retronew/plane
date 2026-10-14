/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useEffect } from "react";
import { EAuthModes } from "@plane/constants";
// components
import { ResetPasswordForm } from "@/components/account/auth-forms/reset-password";
import { AuthHeader } from "@/components/auth-screens/header";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
import { usePasswordManagement } from "@/hooks/use-password-management";
// layouts
import DefaultLayout from "@/layouts/default-layout";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

function SetPasswordPage() {
  const router = useAppRouter();
  const { canManagePassword, isLoading } = usePasswordManagement();

  // Password login is disabled: there is nothing to set
  useEffect(() => {
    if (!isLoading && !canManagePassword) router.replace("/");
  }, [isLoading, canManagePassword, router]);

  return (
    <DefaultLayout>
      <AuthenticationWrapper pageType={EPageTypes.SET_PASSWORD}>
        <div className="relative z-10 flex h-screen w-screen flex-col items-center overflow-hidden overflow-y-auto px-8 pt-6 pb-10">
          <AuthHeader type={EAuthModes.SIGN_IN} />
          {!isLoading && canManagePassword && <ResetPasswordForm />}
        </div>
      </AuthenticationWrapper>
    </DefaultLayout>
  );
}

export default SetPasswordPage;
