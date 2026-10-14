/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useTranslation } from "@plane/i18n";

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null);
const STORAGE_KEY = "workspace_settings_sidebar_collapsed";
const CHANGE_EVENT = "workspace-settings-sidebar-change";
let fallbackCollapsed = false;
function getCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return fallbackCollapsed;
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
function toggle() {
  const next = !getCollapsed();
  fallbackCollapsed = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* Keep the control usable without persistence. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function WorkspaceSettingsSidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, () => false);
  const value = useMemo(() => ({ collapsed, toggle }), [collapsed]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
export const useWorkspaceSettingsSidebar = () => useContext(SidebarContext);
export function WorkspaceSettingsSidebarToggle({ onlyWhenCollapsed = false }: { onlyWhenCollapsed?: boolean }) {
  const sidebar = useWorkspaceSettingsSidebar();
  const { t } = useTranslation();
  if (!sidebar || (onlyWhenCollapsed ? !sidebar.collapsed : sidebar.collapsed)) return null;
  return (
    <span className="hidden shrink-0 md:inline-flex">
      <IconButton
        size="sm"
        variant="ghost"
        icon={sidebar.collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        aria-label={t(sidebar.collapsed ? "web.workspace_sidebar.expand" : "web.workspace_sidebar.collapse")}
        aria-expanded={!sidebar.collapsed}
        aria-controls="workspace-settings-sidebar"
        onClick={sidebar.toggle}
      />
    </span>
  );
}
export function WorkspaceSettingsDesktopSidebar({ children }: { children: React.ReactNode }) {
  const sidebar = useWorkspaceSettingsSidebar();
  return (
    <div
      id="workspace-settings-sidebar"
      aria-hidden={sidebar?.collapsed}
      inert={sidebar?.collapsed}
      className={`hidden h-full shrink-0 overflow-hidden transition-[width] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:block ${sidebar?.collapsed ? "w-0" : "w-[250px]"}`}
    >
      {children}
    </div>
  );
}
