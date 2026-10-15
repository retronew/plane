import type { ReactNode } from "react";
import styles from "@/components/sidebar/sidebar-layout.module.css";

/** Keep the online sidebar's 12px top inset and match the settings header's border inset. */
export function SettingsSidebarHeaderRow({ children }: { children: ReactNode }) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 border-b border-transparent pr-5 pl-4 text-body-md-medium ${styles.headerRow}`}
    >
      {children}
    </div>
  );
}
