import type { ComponentProps } from "react";
import { MenuContent, MenuSubmenuContent } from "@makeplane/propel/components/menu";

/** Compact action menus keep breathing room without Propel's 204px minimum.
 * Use for button-triggered actions, not search/entity selectors or wide anchors.
 */
export function ActionMenuContent({
  children,
  align = "end",
  sizing = "anchor",
  ...props
}: ComponentProps<typeof MenuContent>) {
  return (
    <MenuContent align={align} sizing={sizing} {...props}>
      <div className="max-w-full min-w-20">{children}</div>
    </MenuContent>
  );
}

export function ActionSubmenuContent({
  children,
  sizing = "anchor",
  ...props
}: ComponentProps<typeof MenuSubmenuContent>) {
  return (
    <MenuSubmenuContent sizing={sizing} {...props}>
      <div className="max-w-full min-w-20">{children}</div>
    </MenuSubmenuContent>
  );
}
