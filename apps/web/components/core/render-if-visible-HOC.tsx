/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode, MutableRefObject } from "react";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { cn } from "@plane/utils";
import { runIdleTask } from "@/lib/idle-task";
import { useVisibilityUpdates } from "./visibility-observer-boundary";

type Props = {
  defaultHeight?: string;
  "aria-label"?: string;
  verticalOffset?: number;
  horizontalOffset?: number;
  root?: MutableRefObject<HTMLElement | null>;
  children: ReactNode;
  // @types/react 19 removed the global JSX namespace; it now lives under React.
  as?: keyof React.JSX.IntrinsicElements;
  classNames?: string;
  placeholderChildren?: ReactNode;
  defaultValue?: boolean;
  shouldRecordHeights?: boolean;
  useIdleTime?: boolean;
  forceRender?: boolean;
  preserveWhenCollapsed?: boolean;
  renderVisibleBeforePaint?: boolean;
};

function RenderIfVisible(props: Props) {
  const {
    defaultHeight = "300px",
    root,
    verticalOffset = 50,
    horizontalOffset = 0,
    as = "div",
    children,
    classNames = "",
    shouldRecordHeights = true,
    //placeholder children
    placeholderChildren = null, //placeholder children
    defaultValue = false,
    useIdleTime = false,
    forceRender = false,
    preserveWhenCollapsed = false,
    renderVisibleBeforePaint = false,
  } = props;
  const visibilityUpdates = useVisibilityUpdates();
  const [shouldVisible, setShouldVisible] = useState<boolean>(defaultValue);
  const [placeholderHeight, setPlaceholderHeight] = useState(defaultHeight);
  const intersectionRef = useRef<HTMLElement | null>(null);
  const visibilityIdleTaskRef = useRef<ReturnType<typeof runIdleTask> | null>(null);
  const heightIdleTaskRef = useRef<ReturnType<typeof runIdleTask> | null>(null);

  const isVisible = shouldVisible || forceRender;

  // Visible rows should enter together with loaded data, without waiting for individual observers.
  useLayoutEffect(() => {
    const target = intersectionRef.current;
    if (!renderVisibleBeforePaint || !target || target.closest("[data-closed], [hidden]")) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const bounds = root?.current?.getBoundingClientRect() ?? {
      top: 0,
      left: 0,
      bottom: window.innerHeight,
      right: window.innerWidth,
      width: window.innerWidth,
    };
    // IntersectionObserver resolves percentage root margins against the root width.
    const marginY = (bounds.width * verticalOffset) / 100;
    const marginX = (bounds.width * horizontalOffset) / 100;
    if (
      rect.bottom > bounds.top - marginY &&
      rect.top < bounds.bottom + marginY &&
      rect.right > bounds.left - marginX &&
      rect.left < bounds.right + marginX
    )
      setShouldVisible(true);
  }, [renderVisibleBeforePaint, root, verticalOffset, horizontalOffset]);

  // Set visibility with intersection observer
  useEffect(() => {
    const target = intersectionRef.current;
    if (target && !forceRender) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries[entries.length - 1].isIntersecting;
          const update = () => {
            // Keep the visible subset warm while its group is collapsed; normal scrolling still virtualizes.
            if (preserveWhenCollapsed && target.closest("[data-closed], [hidden]")) return;
            setShouldVisible(visible);
          };
          const schedule = () => {
            if (visibilityUpdates) visibilityUpdates.schedule(target, update);
            else update();
          };
          //DO no remove comments for future
          if (typeof window !== "undefined" && useIdleTime) {
            visibilityIdleTaskRef.current?.cancel();
            visibilityIdleTaskRef.current = runIdleTask(schedule);
          } else {
            schedule();
          }
        },
        {
          root: root?.current,
          rootMargin: `${verticalOffset}% ${horizontalOffset}% ${verticalOffset}% ${horizontalOffset}%`,
        }
      );
      observer.observe(target);
      return () => {
        visibilityIdleTaskRef.current?.cancel();
        visibilityIdleTaskRef.current = null;
        observer.unobserve(target);
        visibilityUpdates?.cancel(target);
      };
    }
  }, [
    intersectionRef,
    root,
    verticalOffset,
    horizontalOffset,
    useIdleTime,
    preserveWhenCollapsed,
    visibilityUpdates,
    forceRender,
  ]);

  //Set height after render
  useEffect(() => {
    if (intersectionRef.current && isVisible && shouldRecordHeights) {
      heightIdleTaskRef.current?.cancel();
      heightIdleTaskRef.current = runIdleTask(() => {
        if (intersectionRef.current) setPlaceholderHeight(`${intersectionRef.current.offsetHeight}px`);
      });
    }
    return () => {
      heightIdleTaskRef.current?.cancel();
      heightIdleTaskRef.current = null;
    };
  }, [isVisible, intersectionRef, shouldRecordHeights]);

  const child = isVisible ? <>{children}</> : placeholderChildren;
  const style = isVisible || !shouldRecordHeights ? {} : { height: placeholderHeight, width: "100%" };
  const className = isVisible || placeholderChildren ? classNames : cn(classNames, "bg-layer-1");

  return React.createElement(as, { ref: intersectionRef, style, className, "aria-label": props["aria-label"] }, child);
}

export default RenderIfVisible;
