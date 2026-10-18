/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// helpers
import { cn } from "@plane/utils";
import { SIDEBAR_ROW_CLASS_NAME } from "@/components/sidebar/sidebar-navigation";

type Props = {
  children: React.ReactNode;
  elementRef: React.RefObject<HTMLDivElement | null>;
  isMenuActive?: boolean;
};

export function FavoriteItemWrapper(props: Props) {
  const { children, elementRef, isMenuActive = false } = props;
  return (
    <>
      <div
        ref={elementRef}
        className={cn(
          SIDEBAR_ROW_CLASS_NAME,
          "group/project-item text-primary has-[[aria-current=page]]:bg-layer-transparent-selected has-[[aria-current=page]]:hover:bg-layer-transparent-selected has-[[aria-current=page]]:active:bg-layer-transparent-selected",
          {
            "bg-surface-2": isMenuActive,
          }
        )}
      >
        {children}
      </div>
    </>
  );
}
