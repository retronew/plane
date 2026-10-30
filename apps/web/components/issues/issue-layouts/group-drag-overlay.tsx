/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { WarningCircleOutline } from "@makeplane/propel/icons";
// plane imports
import { ISSUE_ORDER_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TIssueOrderByOptions } from "@plane/types";
// helpers
import { cn } from "@plane/utils";

type Props = {
  dragColumnOrientation: "justify-start" | "justify-center" | "justify-end";
  workflowDisabledSource?: string;
  canOverlayBeVisible: boolean;
  isDropDisabled: boolean;
  dropErrorMessage?: string;
  orderBy: TIssueOrderByOptions | undefined;
  isDraggingOverColumn: boolean;
};

/**
 * Explains why a dragged work item can't be placed at a precise position in this group.
 * Purely visual: it never takes pointer events or space, so the content under it doesn't move.
 */
export function GroupDragOverlay(props: Props) {
  const {
    dragColumnOrientation,
    canOverlayBeVisible,
    workflowDisabledSource,
    isDropDisabled,
    dropErrorMessage,
    orderBy,
    isDraggingOverColumn,
  } = props;
  // hooks
  const { t } = useTranslation();

  const shouldOverlayBeVisible = isDraggingOverColumn && canOverlayBeVisible;
  if (!shouldOverlayBeVisible) return null;

  const orderByTranslationKey = ISSUE_ORDER_BY_OPTIONS.find(
    (orderByObj) => orderByObj.key === orderBy
  )?.titleTranslationKey;
  const message = workflowDisabledSource || dropErrorMessage;

  return (
    <div
      data-testid="group-drag-overlay"
      className={cn(
        "pointer-events-none absolute inset-0 z-[3] flex flex-col items-center rounded-lg bg-surface-2/80 p-6 text-13 font-medium text-primary",
        dragColumnOrientation,
        { "bg-danger-subtle/80 text-danger-secondary": isDropDisabled && !!message }
      )}
    >
      {message ? (
        <span className="flex items-center gap-1.5 text-center">
          <WarningCircleOutline width={14} height={14} className="shrink-0" />
          {message}
        </span>
      ) : (
        orderByTranslationKey && (
          <span className="text-center">
            {t("issue.layouts.ordered_by_label")} {t(orderByTranslationKey)}
          </span>
        )
      )}
    </div>
  );
}
