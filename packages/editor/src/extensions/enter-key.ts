/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Extension } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const EnterKeyExtension = (
  onEnterKeyPress?: () => void,
  getShortcut: () => "enter" | "mod-enter" = () => "enter"
) =>
  Extension.create({
    name: CORE_EXTENSIONS.ENTER_KEY,

    addKeyboardShortcuts(this) {
      const submit = () => {
        const { activeDropbarExtensions } = this.editor.storage.utility;
        if (this.editor.view.composing || !onEnterKeyPress || activeDropbarExtensions.length > 0) return false;
        onEnterKeyPress();
        return true;
      };
      return {
        Enter: () => getShortcut() === "enter" && submit(),
        "Mod-Enter": () => getShortcut() === "mod-enter" && submit(),
        "Shift-Enter": ({ editor }) =>
          editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.splitListItem(CORE_EXTENSIONS.LIST_ITEM),
            () => commands.splitListItem(CORE_EXTENSIONS.TASK_ITEM),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]),
      };
    },
  });
