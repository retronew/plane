/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
// components
import { OIDCEmailBindForm } from "@/components/account/auth-forms/oidc-email-bind";
import { AuthHeader } from "@/components/views/header";
import type { Route } from "./+types/page";

export const meta: Route.MetaFunction = () => [{ title: translate("web.oidc_email_bind.page_title") }];

export default function OIDCEmailBindPage() {
  return (
    <div className="relative z-10 flex h-screen w-screen flex-col items-center overflow-hidden overflow-y-auto bg-surface-1 px-8 pt-6 pb-10">
      <AuthHeader />
      <OIDCEmailBindForm />
    </div>
  );
}
