import { useLayoutEffect, useRef, type ComponentType } from "react";
import { observeDropGaps } from "./drop-gaps";
import { observeBlockHandlePosition } from "./block-handle-position";
import { GripVertical } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useDraggable, useDropLine } from "@platejs/dnd";
import { useEditorRef } from "platejs/react";
import type { PlateElementProps } from "platejs/react";

function BlockHandle({
  component: Component,
  ...props
}: PlateElementProps & { component: ComponentType<PlateElementProps> }) {
  const { t } = useTranslation();
  const { handleRef, nodeRef, isDragging } = useDraggable({ element: props.element });
  const { dropLine } = useDropLine({ id: String(props.element.id) });
  const positionRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = nodeRef?.current;
    if (!node) return;
    const stopGaps = observeDropGaps(node);
    const stopPosition = positionRef.current ? observeBlockHandlePosition(node, positionRef.current) : undefined;
    return () => {
      stopGaps?.();
      stopPosition?.();
    };
  }, [nodeRef]);
  return (
    <div
      ref={nodeRef}
      className="comparison-draggable group/drag relative"
      data-comparison-block={props.element.id}
      data-block-type={props.element.type}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div
        ref={positionRef}
        contentEditable={false}
        className="comparison-drag-handle absolute -left-5 z-10 opacity-0 group-hover/drag:opacity-100 focus-within:opacity-100"
      >
        <IconButton
          ref={handleRef}
          size="sm"
          variant="ghost"
          icon={<GripVertical className="size-4" />}
          aria-label={t("editor_comparison.dragBlock")}
        />
      </div>
      <div contentEditable={false} className="comparison-drop-gap comparison-drop-gap-before" />
      <Component {...props} />
      <div contentEditable={false} className="comparison-drop-gap comparison-drop-gap-after" />
      {dropLine && (
        <div
          contentEditable={false}
          className={`pointer-events-none absolute inset-x-0 h-0.5 bg-accent-primary ${dropLine === "top" ? "top-0" : "bottom-0"}`}
        />
      )}
    </div>
  );
}

export function withBlockHandle(Component: ComponentType<PlateElementProps>) {
  return function DraggableBlock(props: PlateElementProps) {
    const editor = useEditorRef();
    const path = editor.api.findPath(props.element);
    if (!path || path.length !== 1) return <Component {...props} />;
    return <BlockHandle {...props} component={Component} />;
  };
}
