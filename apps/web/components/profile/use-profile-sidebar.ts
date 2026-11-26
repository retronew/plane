/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { useLocalStorage } from "@plane/hooks";

export function useProfileSidebar(isDesktop: boolean) {
  // The old key was written on every mobile resize; it is not a desktop preference.
  const { storedValue: desktopCollapsed, setValue: setDesktopCollapsed } = useLocalStorage(
    "profile_desktop_sidebar_collapsed",
    false
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  return {
    open: isDesktop ? !desktopCollapsed : mobileOpen,
    toggle: () => (isDesktop ? setDesktopCollapsed(!desktopCollapsed) : setMobileOpen(!mobileOpen)),
    closeMobile: () => setMobileOpen(false),
  };
}
