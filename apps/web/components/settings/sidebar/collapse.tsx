/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { LeftSidePaneOutline } from "@makeplane/propel/icons";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useTranslation } from "@plane/i18n";

type SettingsScope = "workspace" | "project";
const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void; sidebarId: string } | null>(null);
const CHANGE_EVENT = "settings-sidebar-change";
const fallbackCollapsed: Record<SettingsScope, boolean> = { workspace: false, project: false };
const storageKey = (scope: SettingsScope) => `${scope}_settings_sidebar_collapsed`;
function getCollapsed(scope: SettingsScope) {
  try {
    return localStorage.getItem(storageKey(scope)) === "true";
  } catch {
    return fallbackCollapsed[scope];
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
function toggle(scope: SettingsScope) {
  const next = !getCollapsed(scope);
  fallbackCollapsed[scope] = next;
  try {
    localStorage.setItem(storageKey(scope), String(next));
  } catch {
    /* Keep the control usable without persistence. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function SettingsSidebarProvider({
  children,
  scope = "workspace",
}: {
  children: React.ReactNode;
  scope?: SettingsScope;
}) {
  const getSnapshot = useCallback(() => getCollapsed(scope), [scope]);
  const handleToggle = useCallback(() => toggle(scope), [scope]);
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const value = useMemo(
    () => ({ collapsed, toggle: handleToggle, sidebarId: `${scope}-settings-sidebar` }),
    [collapsed, handleToggle, scope]
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
export const useSettingsSidebar = () => useContext(SidebarContext);
export function SettingsSidebarToggle({ onlyWhenCollapsed = false }: { onlyWhenCollapsed?: boolean }) {
  const sidebar = useSettingsSidebar();
  const { t } = useTranslation();
  if (!sidebar || (onlyWhenCollapsed ? !sidebar.collapsed : sidebar.collapsed)) return null;
  return (
    <span className="hidden shrink-0 md:inline-flex">
      <IconButton
        size="md"
        variant="ghost"
        icon={<LeftSidePaneOutline />}
        aria-label={t(sidebar.collapsed ? "web.workspace_sidebar.expand" : "web.workspace_sidebar.collapse")}
        aria-expanded={!sidebar.collapsed}
        aria-controls={sidebar.sidebarId}
        onClick={sidebar.toggle}
      />
    </span>
  );
}
export function SettingsDesktopSidebar({ children }: { children: React.ReactNode }) {
  const sidebar = useSettingsSidebar();
  return (
    <div
      id={sidebar?.sidebarId}
      aria-hidden={sidebar?.collapsed}
      inert={sidebar?.collapsed}
      className={`hidden h-full shrink-0 overflow-hidden transition-[width] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:block ${sidebar?.collapsed ? "w-0" : "w-[250px]"}`}
    >
      {children}
    </div>
  );
}
