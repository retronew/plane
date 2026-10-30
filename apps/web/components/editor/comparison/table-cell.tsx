import { useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, MoreVertical, Plus } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { ResizeHandle } from "@platejs/resizable";
import {
  TableProvider,
  useCellIndices,
  useTableCellElement,
  useTableCellElementResizable,
  useTableColSizes,
  useTableElement,
  useTableSelectionDom,
} from "@platejs/table/react";
// oxlint-disable-next-line import/no-unassigned-import -- Table rendering owns its scoped stylesheet.
import "./table.css";
import { useTranslation } from "@plane/i18n";
import {
  deleteColumn,
  deleteRow,
  deleteTable,
  getTableGridAbove,
  getTableColumnCount,
  insertTableColumn,
  insertTableRow,
  mergeTableCells,
  splitTableCell,
} from "@platejs/table";
import { type SlateEditor, type TElement, type TTableElement } from "platejs";
import { useEditorSelector, useReadOnly } from "platejs/react";

const actions = {
  rowBefore: ["上方插入行", "Insert row above"],
  rowAfter: ["下方插入行", "Insert row below"],
  columnBefore: ["左侧插入列", "Insert column left"],
  columnAfter: ["右侧插入列", "Insert column right"],
  deleteRow: ["删除行", "Delete row"],
  deleteColumn: ["删除列", "Delete column"],
  merge: ["合并单元格", "Merge cells"],
  split: ["拆分单元格", "Split cell"],
  deleteTable: ["删除表格", "Delete table"],
} as const;
export type ComparisonTableAction = keyof typeof actions;

export function getComparisonTableSelection(editor: SlateEditor) {
  const cells = getTableGridAbove(editor, { format: "cell" });
  return {
    canMerge: cells.length > 1,
    canSplit: cells.length === 1 && (Number(cells[0][0].colSpan ?? 1) > 1 || Number(cells[0][0].rowSpan ?? 1) > 1),
    hasCell: cells.length > 0,
  };
}

export function executeComparisonTableAction(editor: SlateEditor, action: ComparisonTableAction) {
  const selection = getComparisonTableSelection(editor);
  if (!selection.hasCell) return;
  switch (action) {
    case "rowBefore":
      insertTableRow(editor, { before: true, select: true });
      break;
    case "rowAfter":
      insertTableRow(editor, { select: true });
      break;
    case "columnBefore":
      insertTableColumn(editor, { before: true, select: true });
      break;
    case "columnAfter":
      insertTableColumn(editor, { select: true });
      break;
    case "deleteRow":
      deleteRow(editor);
      break;
    case "deleteColumn":
      deleteColumn(editor);
      break;
    case "deleteTable":
      deleteTable(editor);
      break;
    case "merge":
      if (selection.canMerge) mergeTableCells(editor);
      break;
    case "split":
      if (selection.canSplit) splitTableCell(editor);
      break;
  }
}

type TableNodeProps = {
  attributes: Record<string, unknown>;
  children?: ReactNode;
  element: TElement;
  editor: SlateEditor;
};

type InsertAction = "rowBefore" | "rowAfter" | "columnBefore" | "columnAfter";

// Anchor to the hovered cell, not the editor selection (which may be elsewhere).
export function insertComparisonTableEdge(editor: SlateEditor, element: TElement, action: InsertAction) {
  const path = editor.api.findPath(element);
  if (!path) return;
  if (action === "rowBefore" || action === "rowAfter") {
    insertTableRow(editor, { fromRow: path.slice(0, -1), before: action === "rowBefore", select: true });
  } else {
    insertTableColumn(editor, { fromCell: path, before: action === "columnBefore", select: true });
  }
}

function TableBody({ attributes, children, element, editor }: TableNodeProps) {
  const { marginLeft, props } = useTableElement();
  const colSizes = useTableColSizes();
  const readOnly = useReadOnly();
  const { t } = useTranslation();
  const tableRef = useRef<HTMLTableElement>(null);
  useTableSelectionDom(tableRef);
  const widths = Array.from(
    { length: getTableColumnCount(element as TTableElement) },
    (_, index) => colSizes[index] || 160
  );
  return (
    <div
      {...attributes}
      className="comparison-table-scroll"
      style={{ paddingLeft: Math.max(12, Number(marginLeft) || 0) }}
    >
      <div className="comparison-table-frame" style={{ width: widths.reduce((sum, width) => sum + width, 0) }}>
        <table
          {...props}
          ref={tableRef}
          className="comparison-table-grid"
          style={{ width: widths.reduce((sum, width) => sum + width, 0) }}
        >
          <colgroup contentEditable={false}>
            {widths.map((width, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- Colgroup entries represent positional column slots, without state or cell IDs.
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <tbody>{children}</tbody>
        </table>
        {!readOnly &&
          (["rowAfter", "columnAfter"] as const).map((action) => (
            <div
              key={action}
              contentEditable={false}
              className={`comparison-table-append comparison-table-append-${action}`}
            >
              <IconButton
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                aria-label={t(`editor_comparison.${action === "rowAfter" ? "insertRow" : "insertColumn"}`)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const rows = element.children as TElement[];
                  const row = action === "rowAfter" ? rows.at(-1) : rows[0];
                  const target = row?.children.at(-1) as TElement | undefined;
                  if (target) insertComparisonTableEdge(editor, target, action);
                  editor.tf.focus();
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

export function ComparisonTable(props: TableNodeProps) {
  return (
    <TableProvider>
      <TableBody {...props} />
    </TableProvider>
  );
}

function TableCellMenu({
  editor,
  element,
  axis,
}: Pick<TableNodeProps, "editor" | "element"> & { axis: "row" | "column" }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSelection = useRef(editor.selection);
  const [menuCapabilities, setMenuCapabilities] = useState({ canMerge: false, canSplit: false });
  const { canMerge, canSplit } = useEditorSelector((current) => getComparisonTableSelection(current), []);
  const runAction = (action: ComparisonTableAction) => {
    if (menuSelection.current) editor.tf.select(menuSelection.current);
    executeComparisonTableAction(editor, action);
    setMenuOpen(false);
    editor.tf.focus();
  };
  return (
    <div className={`comparison-table-more comparison-table-more-${axis}`} data-menu-open={menuOpen || undefined}>
      <Menu open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger
          render={
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              icon={axis === "row" ? <MoreVertical className="size-3.5" /> : <MoreHorizontal className="size-3.5" />}
              aria-label={t(`editor_comparison.${axis === "row" ? "rowActions" : "columnActions"}`)}
              onMouseDown={(event) => {
                const at = editor.api.findPath(element);
                const cells = getTableGridAbove(editor, { format: "cell" });
                if (at && !cells.some(([cell]) => cell.id === element.id)) editor.tf.select(editor.api.start(at)!);
                menuSelection.current = editor.selection ? structuredClone(editor.selection) : null;
                setMenuCapabilities(getComparisonTableSelection(editor));
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          }
        />
        <MenuContent
          side="bottom"
          align="end"
          finalFocus={() => {
            editor.tf.focus();
            return false;
          }}
        >
          {(
            [
              ["rowActions", ["rowBefore", "rowAfter", "deleteRow"]],
              ["columnActions", ["columnBefore", "columnAfter", "deleteColumn"]],
            ] as const
          ).map(([label, items]) => (
            <MenuSubmenu key={label}>
              <MenuSubmenuTrigger label={t(`editor_comparison.${label}`)} />
              <MenuSubmenuContent>
                {items.map((action) => (
                  <MenuItem
                    key={action}
                    label={t(`editor_comparison.${action}`)}
                    variant={action.startsWith("delete") ? "danger" : "neutral"}
                    onClick={() => runAction(action)}
                  />
                ))}
              </MenuSubmenuContent>
            </MenuSubmenu>
          ))}
          <MenuSeparator />
          <MenuItem
            label={t("editor_comparison.merge")}
            disabled={!(menuOpen ? menuCapabilities.canMerge : canMerge)}
            onClick={() => runAction("merge")}
          />
          <MenuItem
            label={t("editor_comparison.split")}
            disabled={!(menuOpen ? menuCapabilities.canSplit : canSplit)}
            onClick={() => runAction("split")}
          />
          <MenuSeparator />
          <MenuItem
            label={t("editor_comparison.deleteTable")}
            variant="danger"
            onClick={() => runAction("deleteTable")}
          />
        </MenuContent>
      </Menu>
    </div>
  );
}

export function ComparisonTableCell({ attributes, children, element, editor }: TableNodeProps) {
  const readOnly = useReadOnly();
  const { col, row } = useCellIndices();
  const cell = useTableCellElement();
  const { rightProps } = useTableCellElementResizable(cell);
  const Tag = element.type === "th" ? "th" : "td";
  return (
    <Tag
      {...attributes}
      data-table-cell-id={element.id}
      data-table-cell-selected={cell.selected || undefined}
      data-table-edge-row={!readOnly && col === 0 ? true : undefined}
      data-table-edge-column={!readOnly && row === 0 ? true : undefined}
      colSpan={cell.colSpan}
      rowSpan={Number(element.rowSpan ?? 1)}
      className="comparison-table-cell border border-strong px-3 py-2 align-top"
      style={{ minWidth: 48, height: cell.minHeight }}
    >
      {children}
      {!readOnly && (
        <>
          <div contentEditable={false} className="comparison-table-controls">
            {col === 0 && <TableCellMenu editor={editor} element={element} axis="row" />}
            {row === 0 && <TableCellMenu editor={editor} element={element} axis="column" />}
          </div>
          <ResizeHandle {...rightProps} className="comparison-table-resize" contentEditable={false} />
        </>
      )}
    </Tag>
  );
}
