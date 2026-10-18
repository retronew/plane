/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";

export const SIDEBAR_ROW_CLASS_NAME =
  "relative flex h-8 w-full items-center gap-2 rounded-lg px-2 text-body-sm-medium hover:bg-layer-transparent-hover active:bg-layer-transparent-active";

export const SIDEBAR_ROW_LINK_CLASS_NAME = "flex h-full min-w-0 flex-grow items-center gap-2";

export const SIDEBAR_ROW_ACTIONS_CLASS_NAME =
  "hidden shrink-0 items-center group-focus-within/project-item:flex group-hover/project-item:flex";

type TSidebarNavItem = {
  className?: string;
  isActive?: boolean;
  children?: React.ReactNode;
};

export function SidebarNavItem(props: TSidebarNavItem) {
  const { className, isActive, children } = props;
  return (
    <div
      className={cn(
        SIDEBAR_ROW_CLASS_NAME,
        "group cursor-pointer justify-between outline-none",
        {
          "bg-layer-transparent-selected text-primary hover:bg-layer-transparent-selected active:bg-layer-transparent-selected":
            isActive,
          "text-secondary": !isActive,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
