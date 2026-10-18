/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { cn } from "@plane/utils";

type TSidebarPropertyListItemProps = {
  icon: React.FC<{ className?: string }>;
  label: string;
  children: ReactNode;
  appendElement?: ReactNode;
  childrenClassName?: string;
  variant?: "default" | "detail";
};

export function SidebarPropertyListItem(props: TSidebarPropertyListItemProps) {
  const { icon: Icon, label, children, appendElement, childrenClassName, variant = "default" } = props;
  const isDetail = variant === "detail";

  return (
    <div className={cn("flex gap-2", isDetail ? "min-h-8 min-w-0 items-center" : "items-start")}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-tertiary",
          isDetail ? "min-h-8 w-[clamp(120px,25%,160px)] text-13" : "h-7.5 w-30 text-body-xs-regular"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className={isDetail ? "min-w-0 break-words" : undefined}>{label}</span>
        {appendElement}
      </div>
      <div
        className={cn(
          "flex grow flex-wrap items-center gap-1",
          isDetail &&
            "min-h-8 min-w-0 flex-1 break-words [&_button]:max-w-full [&_button_span.flex]:max-w-full [&_button_span.flex]:min-w-0 [&>*]:max-w-full",
          childrenClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
