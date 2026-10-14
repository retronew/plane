/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";
import {
  ArrowDownOutline,
  CloseOutline,
  CopyOutline,
  DeleteOutline,
  ToggleFilled,
  TopArrowOutline,
} from "@makeplane/propel/icons";
// extensions
import type { ISvgIcons } from "@plane/blocks/icons";
import { findTable, getSelectedRows } from "@/extensions/table/table/utilities/helpers";
// local imports
import { duplicateRows } from "../actions";
import { TableDragHandleDropdownColorSelector } from "../color-selector";
import { translate } from "@plane/i18n";

const DROPDOWN_ITEMS: {
  key: string;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>> | React.FC<ISvgIcons>;
  action: (editor: Editor) => void;
}[] = [
  {
    key: "insert-above",
    get label() {
      return translate("web.insert_above");
    },
    icon: TopArrowOutline,
    action: (editor) => editor.chain().focus().addRowBefore().run(),
  },
  {
    key: "insert-below",
    get label() {
      return translate("web.insert_below");
    },
    icon: ArrowDownOutline,
    action: (editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    key: "duplicate",
    get label() {
      return translate("web.duplicate");
    },
    icon: CopyOutline,
    action: (editor) => {
      const table = findTable(editor.state.selection);
      if (!table) return;

      const tableMap = TableMap.get(table.node);
      let tr = editor.state.tr;
      const selectedRows = getSelectedRows(editor.state.selection, tableMap);
      tr = duplicateRows(table, selectedRows, tr);
      editor.view.dispatch(tr);
    },
  },
  {
    key: "clear-contents",
    get label() {
      return translate("web.clear_contents");
    },
    icon: CloseOutline,
    action: (editor) => editor.chain().focus().clearSelectedCells().run(),
  },
  {
    key: "delete",
    get label() {
      return translate("delete");
    },
    icon: DeleteOutline,
    action: (editor) => editor.chain().focus().deleteRow().run(),
  },
];

type Props = {
  editor: Editor;
  onClose: () => void;
};

export function RowOptionsDropdown(props: Props) {
  const { editor, onClose } = props;

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 text-left text-11 text-secondary hover:bg-layer-1"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          editor.chain().focus().toggleHeaderRow().run();
          onClose();
        }}
      >
        <div className="flex-grow truncate">{translate("web.header_row")}</div>
        <ToggleFilled className="size-3 shrink-0" />
      </button>
      <hr className="my-2 border-subtle" />
      <TableDragHandleDropdownColorSelector editor={editor} onSelect={onClose} />
      {DROPDOWN_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className="flex w-full items-center gap-2 truncate rounded-sm px-1 py-1.5 text-left text-11 text-secondary hover:bg-layer-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            item.action(editor);
            onClose();
          }}
        >
          <item.icon className="size-3 shrink-0" />
          <div className="flex-grow truncate">{item.label}</div>
        </button>
      ))}
    </>
  );
}
