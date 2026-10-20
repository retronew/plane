/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
// components
// lib
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

export default function ProfileSettingsLayout() {
  return (
    <AuthenticationWrapper>
      <Outlet />
    </AuthenticationWrapper>
  );
}
