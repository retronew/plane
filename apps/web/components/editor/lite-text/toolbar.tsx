/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useSyncExternalStore, useCallback } from "react";
import type { LucideIcon } from "lucide-react";

import { EIssueCommentAccessSpecifier } from "@plane/constants";
// editor
import type { EditorRefApi } from "@plane/editor";
// i18n
import { useTranslation, translate } from "@plane/i18n";
// ui
import { Button } from "@makeplane/propel/components/button";
import { GlobeOutline, LockOutline } from "@makeplane/propel/icons";
import type { ISvgIcons } from "@plane/blocks/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// constants
import { cn } from "@plane/utils";
import type { ToolbarMenuItem } from "@plane/editor";
import { TOOLBAR_ITEMS } from "@plane/editor";
import { pickCommentImage } from "./comment-image-picker";
// helpers

type Props = {
  accessSpecifier?: EIssueCommentAccessSpecifier;
  executeCommand: (item: ToolbarMenuItem) => void;
  handleAccessChange?: (accessKey: EIssueCommentAccessSpecifier) => void;
  handleSubmit: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  isCommentEmpty: boolean;
  isSubmitting: boolean;
  showAccessSpecifier: boolean;
  showSubmitButton: boolean;
  editorRef: EditorRefApi | null;
  submitButtonText?: string;
  compact?: boolean;
  showFormatting?: boolean;
};

type TCommentAccessType = {
  icon: LucideIcon | React.FC<ISvgIcons>;
  key: EIssueCommentAccessSpecifier;
  label: string;
};

const COMMENT_ACCESS_SPECIFIERS: TCommentAccessType[] = [
  {
    icon: LockOutline,
    key: EIssueCommentAccessSpecifier.INTERNAL,
    get label() {
      return translate("web.private");
    },
  },
  {
    icon: GlobeOutline,
    key: EIssueCommentAccessSpecifier.EXTERNAL,
    get label() {
      return translate("web.public");
    },
  },
];

const formattingToolbarItems = TOOLBAR_ITEMS.lite;
const attachmentToolbarItems: Record<string, ToolbarMenuItem[]> = {
  attachments: Object.values(formattingToolbarItems)
    .flat()
    .filter((item) => item.itemKey === "image"),
};
const getServerSnapshot = () => "";

export function IssueCommentToolbar(props: Props) {
  const { t } = useTranslation();
  const {
    accessSpecifier,
    executeCommand,
    handleAccessChange,
    handleSubmit,
    isCommentEmpty,
    isSubmitting,
    showAccessSpecifier,
    showSubmitButton,
    editorRef,
    submitButtonText = "common.comment",
    compact = false,
    showFormatting = true,
  } = props;
  const toolbarItems = showFormatting ? formattingToolbarItems : attachmentToolbarItems;
  const subscribe = useCallback(
    (onStoreChange: () => void) => editorRef?.onStateChange(onStoreChange) ?? (() => undefined),
    [editorRef]
  );
  // A primitive snapshot stays stable until the editor's active menu items change.
  const getSnapshot = useCallback(() => {
    if (!editorRef) return "";
    const activeKeys = Object.values(toolbarItems)
      .flat()
      .filter((item) =>
        // TODO: update this while toolbar homogenization
        // @ts-expect-error type mismatch here
        editorRef.isMenuItemActive({ itemKey: item.itemKey, ...item.extraProps })
      )
      .map((item) => item.renderKey);
    if (editorRef.isEditorReadyToDiscard()) activeKeys.push("ready-to-discard");
    return activeKeys.join(",");
  }, [editorRef, toolbarItems]);
  const activeKeys = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activeStates = new Set(activeKeys.split(","));

  const isEditorReadyToDiscard = editorRef?.isEditorReadyToDiscard();
  const isSubmitButtonDisabled = isCommentEmpty || !isEditorReadyToDiscard;

  return (
    <div
      className={cn("flex h-9 w-full items-stretch gap-1.5 overflow-x-auto", compact ? "pr-1.5 pl-1" : "bg-surface-2")}
    >
      {showAccessSpecifier && (
        <div className="flex flex-shrink-0 items-stretch gap-0.5 rounded-sm border-[0.5px] border-subtle p-1">
          {COMMENT_ACCESS_SPECIFIERS.map((access) => {
            const isAccessActive = accessSpecifier === access.key;

            return (
              <Tooltip key={access.key} label={access.label} layout="stacked">
                <button
                  type="button"
                  onClick={() => handleAccessChange?.(access.key)}
                  aria-label={access.label}
                  className={cn("grid aspect-square place-items-center rounded-xs p-1 hover:bg-layer-1", {
                    "bg-layer-1": isAccessActive,
                  })}
                >
                  <access.icon
                    className={cn("h-3.5 w-3.5 text-placeholder", {
                      "text-primary": isAccessActive,
                    })}
                    strokeWidth={2}
                  />
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
      <div
        className={cn(
          "flex w-full items-stretch justify-between gap-2 p-1",
          !compact && "rounded-sm border-[0.5px] border-subtle"
        )}
      >
        <div className="flex items-stretch">
          {Object.keys(toolbarItems).map((key, index) => (
            <div
              key={key}
              className={cn("flex items-center gap-0.5 border-subtle", compact ? "px-1.5" : "px-2.5", {
                "pl-0": index === 0,
                "border-r": !compact || index < Object.keys(toolbarItems).length - 1,
              })}
            >
              {toolbarItems[key].map((item) => {
                const isItemActive = activeStates.has(item.renderKey);
                const label = t(`web.runtime.comment_toolbar.${item.renderKey.replace("text-align-", "align-")}`);

                return (
                  <Tooltip key={item.renderKey} label={label} shortcut={item.shortcut?.join(" + ")}>
                    <button
                      type="button"
                      onClick={() => (item.itemKey === "image" ? pickCommentImage(editorRef) : executeCommand(item))}
                      aria-label={label}
                      aria-pressed={!!isItemActive}
                      className={cn(
                        compact
                          ? "grid size-6 shrink-0 place-items-center rounded-md p-0 text-icon-secondary outline-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong disabled:text-icon-disabled"
                          : "grid aspect-square place-items-center rounded-xs p-0.5 text-placeholder hover:bg-layer-1",
                        {
                          "bg-layer-transparent-selected": compact && isItemActive,
                          "bg-layer-1 text-primary": !compact && isItemActive,
                        }
                      )}
                    >
                      <item.icon
                        className={cn("h-3.5 w-3.5", {
                          "text-primary": !compact && isItemActive,
                        })}
                        strokeWidth={compact ? 1.5 : 2.5}
                      />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
        {showSubmitButton && (
          <div className={cn("sticky right-1", compact && "flex items-center")}>
            <Button
              type="submit"
              variant={compact ? "secondary" : "primary"}
              size="sm"
              stretch="auto"
              label={t(submitButtonText)}
              onClick={handleSubmit}
              disabled={isSubmitButtonDisabled}
              loading={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
