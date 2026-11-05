import { memo, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { GripVertical } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
import { expandListItemsWithChildren } from "@platejs/list";
import { getPluginByType, isType, type TElement } from "platejs";
import {
  MemoizedChildren,
  useEditorRef,
  useElement,
  type PlateEditor,
  type PlateElementProps,
  type RenderNodeWrapper,
} from "platejs/react";
import { observeBlockHandlePosition } from "./block-handle-position";

// Mirrors the official registry `block-draggable`: rows and cells move with their table.
const UNDRAGGABLE_TYPES = ["tr", "td", "th"];

/** Decide, per rendered element, whether it gets the official draggable wrapper. */
export function isDraggableBlock(editor: PlateEditor, element: TElement, path: number[]): boolean {
  if (editor.dom.readOnly || isType(editor, element, UNDRAGGABLE_TYPES)) return false;
  if (path.length === 1) return true;
  // Blocks inside table cells (table > tr > td > block) are drop targets like in the official kit.
  return path.length === 4 && editor.api.some({ at: path, match: { type: editor.getType("table") } });
}

export const BlockDraggable: RenderNodeWrapper = (props) => {
  const { editor, element, path } = props;
  // oxlint-disable-next-line react-hooks/rules-of-hooks -- Plate calls render.aboveNodes during element render.
  const enabled = useMemo(() => isDraggableBlock(editor, element, path), [editor, element, path]);
  if (!enabled) return;
  return (elementProps) => <Draggable {...elementProps} />;
};

/** Blocks covered by a drag: the text selection's highest blocks when it includes this one. */
export function getDragBlocks(editor: PlateEditor, element: TElement): TElement[] {
  let entries = editor.selection && editor.api.isExpanded() ? editor.api.blocks({ mode: "highest" }) : [];
  if (!entries.some(([node]) => node.id === element.id)) {
    const path = editor.api.findPath(element);
    entries = path ? [[element, path]] : [];
  }
  return expandListItemsWithChildren(editor, entries).map(([node]) => node);
}

function Draggable(props: PlateElementProps) {
  const { children, editor, element, path } = props;
  const { isAboutToDrag, isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    onDropHandler: () => resetPreview(previewRef),
  });
  const originRef = useRef<HTMLDivElement>(null);
  const handlePositionRef = useRef<HTMLDivElement>(null);
  const isInTable = path.length === 4;
  const isContainer = getPluginByType(editor, element.type)?.node.isContainer;

  useEffect(() => {
    if (!isDragging) resetPreview(previewRef);
  }, [isDragging, previewRef]);
  useEffect(() => {
    if (isAboutToDrag) previewRef.current?.classList.remove("opacity-0");
  }, [isAboutToDrag, previewRef]);
  useLayoutEffect(() => {
    const origin = originRef.current;
    const handle = handlePositionRef.current;
    if (!origin || !handle) return;
    return observeBlockHandlePosition(origin, handle);
  }, []);

  return (
    <div
      ref={originRef}
      className={`comparison-draggable plate-block-draggable relative ${isDragging ? "opacity-50" : ""} ${isContainer ? "group/container" : "group"}`}
      data-block-type={element.type}
    >
      {!isInTable && (
        <>
          {/* Invisible gutter left of the block keeps the group hovered on the way to the handle. */}
          <div
            contentEditable={false}
            data-plate-gutter=""
            className="plate-block-gutter absolute top-0 right-full h-full"
          />
          {/* Positioned against the block itself so it follows indented, aligned and task content. */}
          <div
            ref={handlePositionRef}
            contentEditable={false}
            data-plate-drag-handle=""
            className={`plate-block-handle absolute z-10 opacity-0 focus-within:opacity-100 hover:opacity-100 ${isContainer ? "group-hover/container:opacity-100" : "group-hover:opacity-100"}`}
          >
            <DragHandle handleRef={handleRef} previewRef={previewRef} />
          </div>
        </>
      )}
      <div ref={previewRef} contentEditable={false} className="absolute left-0 hidden w-full" />
      <div ref={nodeRef} data-block-content="" className="slate-blockWrapper flow-root">
        <MemoizedChildren>{children}</MemoizedChildren>
        <DropLine />
      </div>
    </div>
  );
}

const DragHandle = memo(function DragHandle({
  handleRef,
  previewRef,
}: {
  handleRef: (node: HTMLElement | null) => void;
  previewRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const editor = useEditorRef();
  const element = useElement();
  return (
    <IconButton
      ref={handleRef}
      size="sm"
      variant="ghost"
      data-plate-prevent-deselect
      icon={<GripVertical className="size-4" />}
      aria-label={t("editor_comparison.dragBlock")}
      onMouseDown={(event) => {
        resetPreview(previewRef);
        if ((event.button !== 0 && event.button !== 2) || event.shiftKey) return;
        const blocks = getDragBlocks(editor, element);
        const preview = previewRef.current;
        if (preview) {
          preview.append(...createDragPreviewElements(editor, blocks));
          preview.classList.remove("hidden");
          preview.classList.add("opacity-0");
          preview.style.top = `${-previewOffset(editor, blocks, element)}px`;
        }
        editor.setOption(DndPlugin, "multiplePreviewRef", previewRef);
        if (blocks.length < 2) {
          editor.tf.blur();
          editor.tf.collapse();
        }
      }}
      onMouseUp={() => resetPreview(previewRef)}
    />
  );
});

const DropLine = memo(function DropLine() {
  const { dropLine } = useDropLine();
  if (!dropLine) return null;
  return (
    <div
      contentEditable={false}
      className={`pointer-events-none absolute inset-x-0 h-0.5 bg-accent-primary ${dropLine === "top" ? "-top-px" : "-bottom-px"}`}
    />
  );
});

function resetPreview(previewRef: RefObject<HTMLDivElement | null>) {
  previewRef.current?.replaceChildren();
  previewRef.current?.classList.add("hidden");
}

function stripSlateAttributes(node: Element) {
  for (const attr of Array.from(node.attributes))
    if (attr.name.startsWith("data-slate") || attr.name.startsWith("data-block-id")) node.removeAttribute(attr.name);
  for (const child of Array.from(node.children)) stripSlateAttributes(child);
}

/** Clone the dragged blocks into the preview so one or many blocks show as the drag image. */
export function createDragPreviewElements(editor: PlateEditor, blocks: TElement[]): HTMLElement[] {
  const ids: string[] = [];
  const elements = blocks.flatMap((node, index) => {
    const dom = editor.api.toDOMNode(node);
    if (!dom) return [];
    const clone = dom.cloneNode(true) as HTMLElement;
    stripSlateAttributes(clone);
    const wrapper = document.createElement("div");
    wrapper.style.display = "flow-root";
    const previous = blocks[index - 1] && editor.api.toDOMNode(blocks[index - 1])?.parentElement;
    if (previous && dom.parentElement) {
      const distance = dom.parentElement.getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
      if (distance > 15) wrapper.style.marginTop = `${distance}px`;
    }
    wrapper.append(clone);
    ids.push(String(node.id));
    return [wrapper];
  });
  editor.setOption(DndPlugin, "draggingId", ids.length > 1 ? ids : (ids[0] ?? null));
  return elements;
}

function previewOffset(editor: PlateEditor, blocks: TElement[], element: TElement) {
  const first = blocks[0] && editor.api.toDOMNode(blocks[0]);
  const current = editor.api.toDOMNode(element);
  if (blocks.length < 2 || !first || !current) return 0;
  return current.getBoundingClientRect().top - first.getBoundingClientRect().top;
}
