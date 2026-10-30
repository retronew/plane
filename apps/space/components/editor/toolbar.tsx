/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useSyncExternalStore, useCallback } from "react";
// plane imports
import { TOOLBAR_ITEMS } from "@plane/editor";
import type { ToolbarMenuItem, EditorRefApi } from "@plane/editor";
import { Button } from "@makeplane/propel/components/button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { cn } from "@plane/utils";
import { translate } from "@plane/i18n";

type Props = {
  executeCommand: (item: ToolbarMenuItem) => void;
  handleSubmit: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  isCommentEmpty: boolean;
  isSubmitting: boolean;
  showSubmitButton: boolean;
  editorRef: EditorRefApi | null;
};

const toolbarItems: Record<string, ToolbarMenuItem[]> = {
  attachments: Object.values(TOOLBAR_ITEMS.lite)
    .flat()
    .filter((item) => item.itemKey === "image"),
};

export function IssueCommentToolbar(props: Props) {
  const { executeCommand, handleSubmit, isCommentEmpty, editorRef, isSubmitting, showSubmitButton } = props;
  const subscribe = useCallback(
    (onChange: () => void) => editorRef?.onStateChange(onChange) ?? (() => {}),
    [editorRef]
  );
  const getSnapshot = useCallback(
    () =>
      Object.values(toolbarItems)
        .flat()
        .map((item) => {
          // TODO: update this while toolbar homogenization
          // @ts-expect-error type mismatch here
          return editorRef?.isMenuItemActive({ itemKey: item.itemKey, ...item.extraProps }) ? "1" : "0";
        })
        .join(""),
    [editorRef]
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const activeStates = Object.fromEntries(
    Object.values(toolbarItems)
      .flat()
      .map((item, index) => [item.renderKey, snapshot[index] === "1"])
  );

  return (
    <div className="flex h-9 w-full items-stretch gap-1.5 overflow-x-scroll">
      <div className="flex w-full items-stretch justify-between gap-2 rounded-sm border-[0.5px] border-subtle p-1">
        <div className="flex items-stretch">
          {Object.keys(toolbarItems).map((key, index) => (
            <div
              key={key}
              className={cn("flex items-stretch gap-0.5 border-r border-subtle px-2.5", {
                "pl-0": index === 0,
              })}
            >
              {toolbarItems[key].map((item) => {
                const isItemActive = activeStates[item.renderKey];

                return (
                  <Tooltip
                    key={item.renderKey}
                    label={item.name}
                    shortcut={item.shortcut ? item.shortcut.join(" + ") : undefined}
                  >
                    <button
                      type="button"
                      aria-label={item.name}
                      onClick={() => executeCommand(item)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-xs p-0.5 text-placeholder hover:bg-layer-transparent-hover",
                        {
                          "bg-layer-transparent-hover text-primary": isItemActive,
                        }
                      )}
                    >
                      <item.icon
                        className={cn("h-3.5 w-3.5", {
                          "text-primary": isItemActive,
                        })}
                        strokeWidth={2.5}
                      />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
        {showSubmitButton && (
          <div className="sticky right-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              stretch="auto"
              label={translate("web.comment")}
              onClick={handleSubmit}
              disabled={isCommentEmpty}
              loading={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
