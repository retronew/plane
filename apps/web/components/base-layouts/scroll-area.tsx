import { useEffect, useRef } from "react";
import type { ComponentPropsWithoutRef, RefObject } from "react";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { cn } from "@plane/utils";

type Props = ComponentPropsWithoutRef<"div"> & {
  axis: "horizontal" | "vertical";
  contentClassName?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
};

/** Keep React in charge of the viewport DOM and preserve native scrolling. */
export function LayoutScrollArea({ axis, children, className, contentClassName, viewportRef, ...props }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const localViewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = viewportRef ?? localViewportRef;
  const [initialize] = useOverlayScrollbars({
    defer: true,
    options: {
      overflow: { x: axis === "horizontal" ? "scroll" : "hidden", y: axis === "vertical" ? "scroll" : "hidden" },
      scrollbars: {
        theme: "os-theme-plane",
        autoHide: "never",
        // shown whenever the content overflows, like the native board scrollbars
        visibility: "auto",
        dragScroll: true,
      },
    },
  });

  useEffect(() => {
    if (hostRef.current && scrollRef.current)
      initialize({ target: hostRef.current, elements: { viewport: scrollRef.current, content: scrollRef.current } });
  }, [initialize, scrollRef]);

  return (
    <div
      {...props}
      ref={hostRef}
      data-layout-scroll-area={axis}
      data-overlayscrollbars-initialize=""
      className={cn("relative min-h-0 min-w-0 overflow-hidden", className)}
    >
      <div
        ref={scrollRef}
        data-overlayscrollbars-contents=""
        className={cn(
          "h-full w-full overscroll-contain",
          axis === "horizontal" ? "overflow-x-auto overflow-y-hidden" : "overflow-x-hidden overflow-y-auto"
        )}
      >
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}
