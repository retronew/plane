/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
// services
import { UserService } from "@/services/user.service";

const userService = new UserService();

/**
 * Whether the current user may set, change or reset a password.
 *
 * With password login disabled a password cannot be used to sign in, so it is
 * hidden from members. Instance admins keep it: God mode signs in with a password.
 */
export const usePasswordManagement = () => {
  const { config } = useInstance();
  const isPasswordLoginEnabled = config?.is_email_password_enabled ?? true;

  const { data: adminStatus, isLoading } = useSWR(
    config && !isPasswordLoginEnabled ? "CURRENT_USER_INSTANCE_ADMIN_STATUS" : null,
    () => userService.currentUserInstanceAdminStatus(),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return {
    canManagePassword: isPasswordLoginEnabled || !!adminStatus?.is_instance_admin,
    isLoading: !config || isLoading,
  };
};
