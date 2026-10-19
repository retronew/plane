/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
// local imports
import { BOOT_LOADER_ID, hasBootFinished, holdBootGate, releaseBootGate } from "./boot-loader-state";
import { LogoSpinner } from "./logo-spinner";

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
  const [coveredByBootLoader] = useState(() => !hasBootFinished());

  useEffect(() => {
    if (!coveredByBootLoader) return undefined;
    holdBootGate();
    return () => releaseBootGate();
  }, [coveredByBootLoader]);

  if (coveredByBootLoader) return null;

  return (
    <div className={className}>
      <LogoSpinner />
    </div>
  );
}
