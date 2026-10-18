import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, TouchEvent } from "react";
import type { TCustomImageAttributes, TCustomImageSize } from "../types";
import { ensurePixelString } from "../utils";

const MIN_SIZE = 100;
function nodeSize(attrs: TCustomImageAttributes): TCustomImageSize {
  return {
    width: ensurePixelString(attrs.width, "35%") ?? "35%",
    height: ensurePixelString(attrs.height, "auto") ?? "auto",
    aspectRatio: attrs.aspectRatio || null,
  };
}
function sized(width: number, aspectRatio: number): TCustomImageSize {
  const bounded = Math.max(MIN_SIZE, width);
  return { width: `${bounded}px`, height: `${bounded / aspectRatio}px`, aspectRatio };
}

type Options = {
  attrs: TCustomImageAttributes;
  editorContainer: HTMLDivElement | null;
  setEditorContainer: (container: HTMLDivElement | null) => void;
  updateAttributes: (attributes: Partial<TCustomImageAttributes>, message: string) => void;
};

export function useImageSize({ attrs, editorContainer, setEditorContainer, updateAttributes }: Options) {
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ source: typeof attrs.src; size: TCustomImageSize } | null>(null);
  const [loadedSource, setLoadedSource] = useState<{ source: typeof attrs.src } | null>(null);
  const gesture = useRef<{ size: TCustomImageSize; cleanup: () => void } | null>(null);
  const keyboardSize = useRef<TCustomImageSize | null>(null);
  const activeDraft = draft?.source === attrs.src ? draft.size : null;
  const size = activeDraft ?? nodeSize(attrs);
  const initialResizeComplete = loadedSource?.source === attrs.src;
  const cancel = () => {
    gesture.current?.cleanup();
    gesture.current = null;
    setDraft(null);
  };
  const committed = useRef(attrs);
  useLayoutEffect(() => {
    const previous = committed.current;
    if (previous.src !== attrs.src) {
      gesture.current?.cleanup();
      gesture.current = null;
    }
    if (
      previous.src !== attrs.src ||
      previous.width !== attrs.width ||
      previous.height !== attrs.height ||
      previous.aspectRatio !== attrs.aspectRatio
    ) {
      keyboardSize.current = null;
    }
    committed.current = attrs;
  });
  useLayoutEffect(
    () => () => {
      gesture.current?.cleanup();
      gesture.current = null;
    },
    []
  );

  const handleImageLoad = () => {
    const img = imageRef.current;
    const container = editorContainer ?? img?.closest<HTMLDivElement>(".editor-container");
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return;
    setEditorContainer(container);
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const current = nodeSize(attrs);
    if (current.width === "35%") {
      const width = Math.round(Math.max(container.clientWidth * 0.35, MIN_SIZE));
      updateAttributes(
        { width: `${width}px`, height: `${Math.round(width / aspectRatio)}px`, aspectRatio },
        "Failed to initialize image size"
      );
    } else if (current.aspectRatio !== aspectRatio) {
      updateAttributes({ ...current, aspectRatio }, "Failed to initialize image aspect ratio");
    }
    setLoadedSource({ source: attrs.src });
  };

  const handleResizeStart = (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const ratio = size.aspectRatio;
    if (!rect || !ratio || !Number.isFinite(ratio)) return;
    cancel();
    const touchId = "touches" in event ? event.touches[0]?.identifier : undefined;
    const move = (e: globalThis.MouseEvent | globalThis.TouchEvent) => {
      const session = gesture.current;
      if (!session) return;
      const point = "touches" in e ? Array.from(e.touches).find((touch) => touch.identifier === touchId) : e;
      if (!point) return;
      if (e.cancelable) e.preventDefault();
      session.size = sized(attrs.alignment === "right" ? rect.right - point.clientX : point.clientX - rect.left, ratio);
      setDraft({ source: attrs.src, size: session.size });
    };
    const end = () => {
      const finalSize = gesture.current?.size;
      cancel();
      if (finalSize) updateAttributes(finalSize, "Failed to update image size");
    };
    const touchEnd = (e: globalThis.TouchEvent) => {
      if (Array.from(e.changedTouches).some((touch) => touch.identifier === touchId)) end();
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", cancel);
      window.removeEventListener("blur", cancel);
    };
    gesture.current = { size, cleanup };
    setDraft({ source: attrs.src, size });
    if ("touches" in event) {
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", touchEnd);
      window.addEventListener("touchcancel", cancel);
    } else {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", end);
    }
    window.addEventListener("blur", cancel);
  };

  const handleResizeKeyDown = (event: KeyboardEvent) => {
    const directions: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 };
    let direction = directions[event.key];
    if (!direction || !size.aspectRatio) return;
    event.preventDefault();
    event.stopPropagation();
    if (attrs.alignment === "right" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) direction *= -1;
    const current = keyboardSize.current ?? size;
    const width = /^\d+(?:\.\d+)?px$/.test(current.width)
      ? parseFloat(current.width)
      : containerRef.current?.getBoundingClientRect().width;
    if (!width || !Number.isFinite(width)) return;
    const next = sized(width + direction * (event.shiftKey ? 50 : 10), size.aspectRatio);
    keyboardSize.current = next;
    updateAttributes(next, "Failed to resize image with keyboard");
  };
  return {
    imageRef,
    containerRef,
    size,
    isResizing: activeDraft !== null,
    initialResizeComplete,
    handleImageLoad,
    handleResizeStart,
    handleResizeKeyDown,
  };
}
