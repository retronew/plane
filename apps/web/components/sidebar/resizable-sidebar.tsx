/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, ReactElement, SetStateAction } from "react";
import React, { useCallback, useEffect, useState, useRef } from "react";
// helpers
import { usePlatformOS } from "@plane/hooks";
import { cn } from "@plane/utils";
import { translate } from "@plane/i18n";

interface ResizableSidebarProps {
  showPeek?: boolean;
  togglePeek: (value?: boolean) => void;
  isCollapsed?: boolean;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  peekDuration?: number;
  toggleCollapsed: (value?: boolean) => void;
  onWidthChange?: (width: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  children?: ReactElement;
  extendedSidebar?: ReactElement;
  isAnyExtendedSidebarExpanded?: boolean;
  isAnySidebarDropdownOpen?: boolean;
}

export function ResizableSidebar({
  showPeek = false,
  togglePeek,
  peekDuration = 500,
  isCollapsed = false,
  toggleCollapsed: toggleCollapsedProp,
  onCollapsedChange,
  width,
  setWidth,
  onWidthChange,
  minWidth = 236,
  maxWidth = 350,
  className = "",
  children,
  extendedSidebar,
  isAnyExtendedSidebarExpanded = false,
  isAnySidebarDropdownOpen = false,
}: ResizableSidebarProps) {
  // states
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);
  // refs
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialWidthRef = useRef<number>(0);
  const initialMouseXRef = useRef<number>(0);
  // hooks
  const { isMobile } = usePlatformOS();
  // handlers
  const setShowPeek = useCallback(
    (value: boolean) => {
      togglePeek(value);
    },
    [togglePeek]
  );

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - initialMouseXRef.current;
      const newWidth = Math.min(Math.max(initialWidthRef.current + deltaX, minWidth), maxWidth);
      setWidth(newWidth);
    },
    [isResizing, minWidth, maxWidth, setWidth]
  );

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      initialWidthRef.current = width;
      initialMouseXRef.current = e.clientX;
    },
    [width]
  );

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    let next = width;
    if (event.key === "ArrowLeft") next -= 10;
    else if (event.key === "ArrowRight") next += 10;
    else if (event.key === "Home") next = minWidth;
    else if (event.key === "End") next = maxWidth;
    else return;
    event.preventDefault();
    setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
  };

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    toggleCollapsedProp();
    setShowPeek(false);
    setIsHoveringTrigger(false);
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
    }
  }, [toggleCollapsedProp, setShowPeek]);

  const handlePeekEnter = useCallback(() => {
    if (isCollapsed && showPeek) {
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    }
  }, [isCollapsed, showPeek]);

  const handlePeekLeave = useCallback(() => {
    if (isCollapsed && !isAnyExtendedSidebarExpanded && !isAnySidebarDropdownOpen) {
      peekTimeoutRef.current = setTimeout(() => {
        setShowPeek(false);
      }, peekDuration);
    }
  }, [isCollapsed, peekDuration, setShowPeek, isAnyExtendedSidebarExpanded, isAnySidebarDropdownOpen]);

  // Set up event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleResize, stopResizing]);

  // Clean up timeout on unmount
  useEffect(
    () => () => {
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isAnySidebarDropdownOpen && isCollapsed && isHoveringTrigger) {
      handlePeekLeave();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- react only to the dropdown closing
  }, [isAnySidebarDropdownOpen]);

  useEffect(() => {
    if (!isAnyExtendedSidebarExpanded && isCollapsed && isHoveringTrigger) {
      handlePeekLeave();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- react only to the extended sidebar collapsing
  }, [isAnyExtendedSidebarExpanded]);

  // Reset peek when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      setShowPeek(false);
      setIsHoveringTrigger(false);
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    }
  }, [isCollapsed, setShowPeek]);

  // Call external handlers when state changes
  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  return (
    <>
      {/* Main Sidebar */}
      <aside
        id="main-sidebar"
        className={cn(
          "z-20 h-full border-r border-subtle bg-surface-1",
          !isResizing && "transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 translate-x-[-100%] border-r-0 opacity-0" : "translate-x-0 opacity-100",
          isMobile && "absolute",
          className
        )}
        style={{
          width: `${isCollapsed ? 0 : width}px`,
          minWidth: `${isCollapsed ? 0 : width}px`,
          maxWidth: `${isCollapsed ? 0 : width}px`,
        }}
        aria-label={translate("web.main_sidebar")}
        data-prevent-outside-click={isMobile}
      >
        <div
          className={cn(
            "group/sidebar relative flex h-full w-full flex-col overflow-hidden bg-surface-1",
            isAnyExtendedSidebarExpanded && "rounded-none"
          )}
        >
          {children}

          {/* Resize Handle */}
          <input
            type="range"
            min={minWidth}
            max={maxWidth}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            className={cn(
              "m-0 appearance-none rounded-none border-0 p-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none",
              "absolute z-[20] h-full w-1 cursor-ew-resize transition-all duration-200",
              !isResizing && "hover:bg-surface-2",
              isResizing && "w-1.5 bg-layer-1",
              "top-0 right-0"
            )}
            // onDoubleClick toggle sidebar
            onDoubleClick={() => toggleCollapsed()}
            onMouseDown={(e) => startResizing(e)}
            tabIndex={isCollapsed ? -1 : 0}
            aria-orientation="horizontal"
            onKeyDown={handleResizeKeyDown}
            aria-label={translate("web.resize_sidebar")}
          />
        </div>
      </aside>
      {/* Peek View */}
      <aside
        className={cn(
          "shadow-sm absolute left-0 z-20 h-full bg-surface-1",
          !isResizing && "transition-all duration-300 ease-in-out",
          isCollapsed && showPeek ? "translate-x-0 opacity-100" : "translate-x-[-100%] opacity-0",
          "pointer-events-none",
          isCollapsed && showPeek && "pointer-events-auto",
          !showPeek ? "w-0" : "w-full"
        )}
        style={{
          width: `${width}px`,
        }}
        aria-label={translate("web.sidebar_peek_view")}
      >
        <div
          role="presentation"
          onMouseEnter={handlePeekEnter}
          onMouseLeave={handlePeekLeave}
          className={cn(
            "group/sidebar relative z-20 flex h-full w-full flex-col overflow-hidden bg-surface-1",
            "self-center rounded-md rounded-tl-none rounded-bl-none border-r border-subtle",
            isAnyExtendedSidebarExpanded && "rounded-none"
          )}
        >
          {children}
          {/* Resize Handle */}
          <input
            type="range"
            min={minWidth}
            max={maxWidth}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            className={cn(
              "m-0 appearance-none rounded-none border-0 p-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none",
              "absolute z-[20] h-full w-1 cursor-ew-resize transition-all duration-200",
              !isResizing && "hover:bg-surface-2",
              isResizing && "bg-layer-1",
              "top-0 right-0"
            )}
            // onDoubleClick toggle sidebar
            onDoubleClick={() => toggleCollapsed()}
            onMouseDown={(e) => startResizing(e)}
            tabIndex={isCollapsed && showPeek ? 0 : -1}
            aria-orientation="horizontal"
            onKeyDown={handleResizeKeyDown}
            aria-label={translate("web.resize_sidebar")}
          />
        </div>
      </aside>

      {/* Extended Sidebar */}
      {extendedSidebar}
    </>
  );
}
