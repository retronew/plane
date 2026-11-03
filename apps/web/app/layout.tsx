/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { Outlet, redirect } from "react-router";
// plane imports
import { cn } from "@plane/utils";
// components
import { scheduleBootFinish } from "@/components/common/boot-loader-state";
import { AppUpdateNotice } from "@/components/common/app-update-notice";
// local
import { ensureTrailingSlash } from "./compat/next/helper";
import { AppProvider } from "./provider";
import type { Route } from "./+types/layout";

const trailingSlashRedirectMiddleware: Route.ClientMiddlewareFunction = async ({ request }, next) => {
  const canonical = ensureTrailingSlash(request.url);
  if (canonical !== request.url) {
    throw redirect(canonical, { status: 308 });
  }
  return next();
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [trailingSlashRedirectMiddleware];

// Pathless layout route wrapping every route (see app/routes.ts). Providers, the store
// layer, and app chrome live here instead of root.tsx so they stay out of the SPA-mode
// server build — see the note in app/root.tsx.
export default function AppShellLayout() {
  // Child effects run first, so any loading gate has registered by now; if none did, this hides the boot loader.
  useEffect(() => {
    scheduleBootFinish();
  }, []);

  return (
    <AppProvider>
      <div className={cn("relative flex h-screen w-full flex-col overflow-hidden bg-canvas", "desktop-app-container")}>
        <AppUpdateNotice />
        <main className="relative min-h-0 w-full flex-1 overflow-hidden [&_.h-screen]:h-full">
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
}
