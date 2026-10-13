/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
// local imports
import { LogoSpinner } from "./logo-spinner";

/**
 * Startup goes through several loading gates (instance, auth, workspace). Each used to render its own
 * spinner, so the GIF restarted and the backdrop changed at every hand-off, which read as flicker.
 * Instead, root.tsx's Layout renders one boot loader that survives hydration, and the gates only keep
 * it up while they are pending. Once nothing is pending it hides for good and gates render inline.
 */
export const BOOT_LOADER_ID = "app-boot-loader";

let pendingGates = 0;
let isBootFinished = false;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Hides the boot loader for good. Safe to call more than once. */
export const finishBoot = () => {
  clearTimeout(hideTimer);
  if (isBootFinished) return;
  isBootFinished = true;
  document.getElementById(BOOT_LOADER_ID)?.setAttribute("hidden", "");
};

/**
 * Hides the boot loader once no gate is pending. Deferred so that one gate handing off to the next
 * within the same commit doesn't drop the count to zero for an instant.
 */
export const scheduleBootFinish = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (pendingGates === 0) finishBoot();
  }, 50);
};

/** The boot loader itself, rendered once by root.tsx's Layout. */
export function BootLoader() {
  return (
    <div id={BOOT_LOADER_ID} className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas">
      <LogoSpinner />
    </div>
  );
}

type AppLoaderProps = {
  className?: string;
};

/**
 * A loading gate. During startup it keeps the boot loader up and renders nothing; afterwards it
 * renders an inline spinner inside `className`.
 */
export function AppLoader({ className }: AppLoaderProps) {
  const [coveredByBootLoader] = useState(() => !isBootFinished);

  useEffect(() => {
    if (!coveredByBootLoader) return undefined;
    pendingGates += 1;
    clearTimeout(hideTimer);
    return () => {
      pendingGates -= 1;
      scheduleBootFinish();
    };
  }, [coveredByBootLoader]);

  if (coveredByBootLoader) return null;

  return (
    <div className={className}>
      <LogoSpinner />
    </div>
  );
}
