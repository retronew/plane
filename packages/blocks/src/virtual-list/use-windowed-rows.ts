import { useCallback, useLayoutEffect, useState } from "react";
import type { Key, RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";

type Options = {
  count: number;
  estimateSize: number;
  getItemKey: (index: number) => Key;
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  headerHeight?: number;
};

/** Window rows in an existing scroller, including multiple grouped lists sharing it. */
export function useWindowedRows({
  count,
  estimateSize,
  getItemKey,
  scrollRef,
  contentRef,
  enabled = true,
  headerHeight = 0,
}: Options) {
  const [scrollMargin, setScrollMargin] = useState(0);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indices = new Set(defaultRangeExtractor(range));
      // Retain the focused row, open menu trigger, or drag source while it is being used.
      contentRef.current?.querySelectorAll<HTMLElement>("[data-virtual-index]").forEach((row) => {
        if (
          row.contains(document.activeElement) ||
          row.querySelector('[aria-expanded="true"], [data-virtual-pinned="true"]')
        ) {
          const index = Number(row.dataset.virtualIndex);
          if (index >= 0 && index < count) indices.add(index);
        }
      });
      return [...indices].toSorted((a, b) => a - b);
    },
    [contentRef, count]
  );
  // oxlint-disable-next-line react/incompatible-library -- This hook owns TanStack's mutable instance and reads its range on each render.
  const virtualizer = useVirtualizer({
    count,
    enabled,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey,
    overscan: 8,
    scrollMargin,
    scrollPaddingStart: 44,
    rangeExtractor,
    measureElement: (element, entry, instance) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
      // A collapsed group's display:none must not erase its measured row heights.
      return height || instance.measurementsCache[Number(element.getAttribute("data-index"))]?.size || estimateSize;
    },
  });
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;
    if (!enabled || !viewport || !content) return;
    const measureOffset = () => {
      if (content.closest("[hidden], [data-closed]")) return;
      const offset =
        content.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop + headerHeight;
      setScrollMargin((previous) => (Math.abs(previous - offset) > 0.5 ? offset : previous));
    };
    measureOffset();
    const observer = new ResizeObserver(measureOffset);
    observer.observe(viewport);
    // A preceding group can collapse/expand without resizing the viewport or this list.
    [...viewport.children].forEach((child) => observer.observe(child));
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollRef, contentRef, enabled, count, headerHeight]);
  return { virtualizer, scrollMargin };
}
