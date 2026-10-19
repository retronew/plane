/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Startup goes through several loading gates (instance, auth, workspace). Each used to render its own
 * spinner, so the GIF restarted and the backdrop changed at every hand-off, which read as flicker.
 * Instead, root.tsx's Layout renders one boot loader that survives hydration, and the gates only keep
 * it up while they are pending. Once nothing is pending it hides for good and gates render inline.
 *
 * The state lives here, apart from the components, so the module that renders the loader and the
 * module that owns the gates do not have to be the same file (and Fast Refresh stays useful).
 */
export const BOOT_LOADER_ID = "app-boot-loader";

let pendingGates = 0;
let bootFinished = false;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Whether the boot loader has already hidden for good. */
export const hasBootFinished = () => bootFinished;

/** Hides the boot loader for good. Safe to call more than once. */
export const finishBoot = () => {
  clearTimeout(hideTimer);
  if (bootFinished) return;
  bootFinished = true;
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

/** Marks a gate as pending; pair it with `releaseBootGate` in the effect cleanup. */
export const holdBootGate = () => {
  pendingGates += 1;
  clearTimeout(hideTimer);
};

/** Releases a gate held by `holdBootGate`. */
export const releaseBootGate = () => {
  pendingGates -= 1;
  scheduleBootFinish();
};
