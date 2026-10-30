/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useCallback, useSyncExternalStore } from "react";
import { DeleteOutline, PaletteOutline } from "@makeplane/propel/icons";
// editor
import type { EditorRefApi } from "@plane/editor";
// ui
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TSticky } from "@plane/types";
// constants
import type { ToolbarMenuItem } from "@plane/editor";
import { TOOLBAR_ITEMS } from "@plane/editor";
// helpers
import { ColorPalette } from "./color-palette";
import { translate, useTranslation } from "@plane/i18n";

type Props = {
  executeCommand: (item: ToolbarMenuItem) => void;
  editorRef: EditorRefApi | null;
  handleColorChange: (data: Partial<TSticky>) => Promise<void>;
  handleDelete: () => void;
  selectedColor?: string;
  showFormatting?: boolean;
};

const toolbarItems = TOOLBAR_ITEMS.sticky;
const formattingItems = Object.values(toolbarItems).flat();
const getServerSnapshot = () => "";

export function StickyEditorToolbar(props: Props) {
  const { executeCommand, editorRef, handleColorChange, handleDelete, selectedColor, showFormatting = true } = props;

  const [showColorPalette, setShowColorPalette] = useState(false);
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    bold: t("stickies.toolbar.bold"),
    italic: t("stickies.toolbar.italic"),
    "to-do-list": t("stickies.toolbar.todo"),
  };
  const subscribe = useCallback(
    (onChange: () => void) => editorRef?.onStateChange(onChange) ?? (() => {}),
    [editorRef]
  );
  const getSnapshot = useCallback(
    () =>
      formattingItems
        .map((item) => {
          // @ts-expect-error dynamic toolbar item keys include command-specific props
          return editorRef?.isMenuItemActive({
            itemKey: item.itemKey,
            ...item.extraProps,
          })
            ? "1"
            : "0";
        })
        .join(""),
    [editorRef]
  );
  const activeStates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex h-full w-full items-center justify-between border-t border-subtle/60 pt-2">
      <div className="flex items-center gap-1">
        <Popover open={showColorPalette} onOpenChange={setShowColorPalette}>
          <PopoverTrigger
            render={
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={translate("web.background_color")}
                icon={<PaletteOutline />}
              />
            }
          />
          <PopoverContent
            side="top"
            align="start"
            aria-label={translate("web.background_colors")}
            data-sticky-color-popover=""
          >
            <ColorPalette
              handleUpdate={handleColorChange}
              selectedColor={selectedColor}
              onSelect={() => setShowColorPalette(false)}
            />
          </PopoverContent>
        </Popover>
        {showFormatting &&
          formattingItems.map((item, index) => (
            <Tooltip
              key={item.renderKey}
              label={labels[item.itemKey] ?? item.name}
              shortcut={item.shortcut?.join(" + ")}
            >
              <IconButton
                variant={activeStates[index] === "1" ? "tertiary" : "ghost"}
                size="sm"
                aria-label={labels[item.itemKey] ?? item.name}
                aria-pressed={activeStates[index] === "1"}
                showTooltip={false}
                onClick={() => executeCommand(item)}
                icon={<item.icon />}
              />
            </Tooltip>
          ))}
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={translate("stickies.delete")}
        onClick={handleDelete}
        icon={<DeleteOutline />}
      />
    </div>
  );
}
