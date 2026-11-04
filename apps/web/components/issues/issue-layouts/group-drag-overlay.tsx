/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { WarningCircleOutline } from "@makeplane/propel/icons";
import { createPortal } from "react-dom";
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
      {message
        ? typeof document !== "undefined" &&
          createPortal(
            <output className="shadow-lg pointer-events-none fixed inset-x-4 top-20 z-[2000] mx-auto flex w-fit max-w-lg items-start gap-2.5 rounded-lg border border-subtle bg-warning-subtle px-4 py-3 text-left text-body-sm-medium leading-6 text-warning-primary">
              <WarningCircleOutline width={20} height={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{message}</span>
            </output>,
            document.body
          )
        : orderByTranslationKey && (
            <span className="text-center">
              {t("issue.layouts.ordered_by_label")} {t(orderByTranslationKey)}
            </span>
          )}
    </div>
  );
}
