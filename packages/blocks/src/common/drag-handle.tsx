/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { forwardRef } from "react";
import { GripVertical } from "lucide-react";
import { useTranslation } from "@plane/i18n";
// helpers
import { cn } from "@plane/utils";

interface IDragHandle {
  /** Accessible name for the icon-only handle; defaults to the translated "Drag to rearrange". */
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
}

export const DragHandle = forwardRef(function DragHandle(
  props: IDragHandle,
  ref: React.ForwardedRef<HTMLButtonElement | null>
) {
  const { "aria-label": ariaLabel, className, disabled = false } = props;
  const { t } = useTranslation();

  if (disabled) {
    return <div className="h-[18px] w-[14px]" />;
  }

  return (
    <button
      type="button"
      className={cn("flex flex-shrink-0 cursor-grab rounded-sm bg-surface-2 p-0.5 text-secondary", className)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      ref={ref}
      aria-label={ariaLabel ?? t("drag_to_rearrange")}
    >
      <GripVertical aria-hidden="true" focusable="false" className="size-3.5 text-placeholder" />
    </button>
  );
});

DragHandle.displayName = "DragHandle";
