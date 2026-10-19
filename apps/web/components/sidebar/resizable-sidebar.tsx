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

const RESIZE_STEP = 10;

function getNextWidthForKey(key: string, width: number, minWidth: number, maxWidth: number) {
  if (key === "ArrowLeft") return width - RESIZE_STEP;
  if (key === "ArrowRight") return width + RESIZE_STEP;
  if (key === "Home") return minWidth;
  if (key === "End") return maxWidth;
  return null;
}

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

type TUseSidebarResizeArgs = {
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  minWidth: number;
  maxWidth: number;
};

function useSidebarResize({ width, setWidth, minWidth, maxWidth }: TUseSidebarResizeArgs) {
  // states
  const [isResizing, setIsResizing] = useState(false);
  // refs
  const initialWidthRef = useRef<number>(0);
  const initialMouseXRef = useRef<number>(0);

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - initialMouseXRef.current;
      const newWidth = clampWidth(initialWidthRef.current + deltaX, minWidth, maxWidth);
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

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const next = getNextWidthForKey(event.key, width, minWidth, maxWidth);
    if (next === null) return;
    event.preventDefault();
    setWidth(clampWidth(next, minWidth, maxWidth));
  };

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

  return { isResizing, startResizing, handleResizeKeyDown };
}

type TUsePeekTimeoutArgs = {
  setShowPeek: (value: boolean) => void;
  peekDuration: number;
};

function usePeekTimeout({ setShowPeek, peekDuration }: TUsePeekTimeoutArgs) {
  // refs
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearPeekTimeout = useCallback(() => {
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
    }
  }, []);

  const schedulePeekHide = useCallback(() => {
    peekTimeoutRef.current = setTimeout(() => {
      setShowPeek(false);
    }, peekDuration);
  }, [peekDuration, setShowPeek]);

  // Clean up timeout on unmount
  useEffect(() => () => clearPeekTimeout(), [clearPeekTimeout]);

  return { clearPeekTimeout, schedulePeekHide };
}

type TUsePeekAutoHideArgs = {
  isAnySidebarDropdownOpen: boolean;
  isAnyExtendedSidebarExpanded: boolean;
  isCollapsed: boolean;
  isHoveringTrigger: boolean;
  onPeekLeave: () => void;
};

function usePeekAutoHide({
  isAnySidebarDropdownOpen,
  isAnyExtendedSidebarExpanded,
  isCollapsed,
  isHoveringTrigger,
  onPeekLeave,
}: TUsePeekAutoHideArgs) {
  useEffect(() => {
    if (!isAnySidebarDropdownOpen && isCollapsed && isHoveringTrigger) {
      onPeekLeave();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- react only to the dropdown closing
  }, [isAnySidebarDropdownOpen]);

  useEffect(() => {
    if (!isAnyExtendedSidebarExpanded && isCollapsed && isHoveringTrigger) {
      onPeekLeave();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- react only to the extended sidebar collapsing
  }, [isAnyExtendedSidebarExpanded]);
}

type TUsePeekSidebarArgs = {
  isCollapsed: boolean;
  showPeek: boolean;
  togglePeek: (value?: boolean) => void;
  peekDuration: number;
  toggleCollapsedProp: (value?: boolean) => void;
  isAnyExtendedSidebarExpanded: boolean;
  isAnySidebarDropdownOpen: boolean;
};

function usePeekSidebar({
  isCollapsed,
  showPeek,
  togglePeek,
  peekDuration,
  toggleCollapsedProp,
  isAnyExtendedSidebarExpanded,
  isAnySidebarDropdownOpen,
}: TUsePeekSidebarArgs) {
  // states
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);

  const setShowPeek = useCallback(
    (value: boolean) => {
      togglePeek(value);
    },
    [togglePeek]
  );
  const { clearPeekTimeout, schedulePeekHide } = usePeekTimeout({ setShowPeek, peekDuration });

  const handlePeekEnter = useCallback(() => {
    if (isCollapsed && showPeek) {
      clearPeekTimeout();
    }
  }, [isCollapsed, showPeek, clearPeekTimeout]);

  const handlePeekLeave = useCallback(() => {
    if (isCollapsed && !isAnyExtendedSidebarExpanded && !isAnySidebarDropdownOpen) {
      schedulePeekHide();
    }
  }, [isCollapsed, schedulePeekHide, isAnyExtendedSidebarExpanded, isAnySidebarDropdownOpen]);

  const toggleCollapsed = useCallback(() => {
    toggleCollapsedProp();
    setShowPeek(false);
    setIsHoveringTrigger(false);
    clearPeekTimeout();
  }, [toggleCollapsedProp, setShowPeek, clearPeekTimeout]);

  usePeekAutoHide({
    isAnySidebarDropdownOpen,
    isAnyExtendedSidebarExpanded,
    isCollapsed,
    isHoveringTrigger,
    onPeekLeave: handlePeekLeave,
  });

  // Reset peek when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent -- closing the hover peek on expand is a transition notification, not a per-render sync
      setShowPeek(false);
      // oxlint-disable-next-line react/set-state-in-effect react-doctor/no-adjust-state-on-prop-change -- expanding the sidebar ends the hover peek; the state belongs to that transition
      setIsHoveringTrigger(false);
      clearPeekTimeout();
    }
  }, [isCollapsed, setShowPeek, clearPeekTimeout]);

  return { handlePeekEnter, handlePeekLeave, toggleCollapsed };
}

const RESIZE_HANDLE_ACTIVE_CLASS = {
  main: "w-1.5 bg-layer-1",
  peek: "bg-layer-1",
} as const;

type TResizeHandleProps = {
  variant: keyof typeof RESIZE_HANDLE_ACTIVE_CLASS;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  minWidth: number;
  maxWidth: number;
  isResizing: boolean;
  tabIndex: number;
  onStartResizing: (event: React.MouseEvent) => void;
  onToggleCollapsed: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function ResizeHandle({
  variant,
  width,
  setWidth,
  minWidth,
  maxWidth,
  isResizing,
  tabIndex,
  onStartResizing,
  onToggleCollapsed,
  onKeyDown,
}: TResizeHandleProps) {
  return (
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
        isResizing && RESIZE_HANDLE_ACTIVE_CLASS[variant],
        "top-0 right-0"
      )}
      // onDoubleClick toggle sidebar
      onDoubleClick={() => onToggleCollapsed()}
      onMouseDown={(e) => onStartResizing(e)}
      tabIndex={tabIndex}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      aria-label={translate("web.resize_sidebar")}
    />
  );
}

type TMainSidebarProps = {
  isCollapsed: boolean;
  isMobile: boolean;
  isResizing: boolean;
  isAnyExtendedSidebarExpanded: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  setWidth: Dispatch<SetStateAction<number>>;
  className: string;
  children?: ReactElement;
  onStartResizing: (event: React.MouseEvent) => void;
  onToggleCollapsed: () => void;
  onResizeKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function MainSidebar({
  isCollapsed,
  isMobile,
  isResizing,
  isAnyExtendedSidebarExpanded,
  width,
  minWidth,
  maxWidth,
  setWidth,
  className,
  children,
  onStartResizing,
  onToggleCollapsed,
  onResizeKeyDown,
}: TMainSidebarProps) {
  return (
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
        <ResizeHandle
          variant="main"
          width={width}
          setWidth={setWidth}
          minWidth={minWidth}
          maxWidth={maxWidth}
          isResizing={isResizing}
          tabIndex={isCollapsed ? -1 : 0}
          onStartResizing={onStartResizing}
          onToggleCollapsed={onToggleCollapsed}
          onKeyDown={onResizeKeyDown}
        />
      </div>
    </aside>
  );
}

type TPeekSidebarProps = {
  isCollapsed: boolean;
  showPeek: boolean;
  isResizing: boolean;
  isAnyExtendedSidebarExpanded: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  setWidth: Dispatch<SetStateAction<number>>;
  children?: ReactElement;
  onStartResizing: (event: React.MouseEvent) => void;
  onToggleCollapsed: () => void;
  onResizeKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPeekEnter: () => void;
  onPeekLeave: () => void;
};

function PeekSidebar({
  isCollapsed,
  showPeek,
  isResizing,
  isAnyExtendedSidebarExpanded,
  width,
  minWidth,
  maxWidth,
  setWidth,
  children,
  onStartResizing,
  onToggleCollapsed,
  onResizeKeyDown,
  onPeekEnter,
  onPeekLeave,
}: TPeekSidebarProps) {
  const isPeekVisible = isCollapsed && showPeek;

  return (
    <aside
      className={cn(
        "shadow-sm absolute left-0 z-20 h-full bg-surface-1",
        !isResizing && "transition-all duration-300 ease-in-out",
        isPeekVisible ? "translate-x-0 opacity-100" : "translate-x-[-100%] opacity-0",
        "pointer-events-none",
        isPeekVisible && "pointer-events-auto",
        !showPeek ? "w-0" : "w-full"
      )}
      style={{
        width: `${width}px`,
      }}
      aria-label={translate("web.sidebar_peek_view")}
    >
      <div
        role="presentation"
        onMouseEnter={onPeekEnter}
        onMouseLeave={onPeekLeave}
        className={cn(
          "group/sidebar relative z-20 flex h-full w-full flex-col overflow-hidden bg-surface-1",
          "self-center rounded-md rounded-tl-none rounded-bl-none border-r border-subtle",
          isAnyExtendedSidebarExpanded && "rounded-none"
        )}
      >
        {children}
        {/* Resize Handle */}
        <ResizeHandle
          variant="peek"
          width={width}
          setWidth={setWidth}
          minWidth={minWidth}
          maxWidth={maxWidth}
          isResizing={isResizing}
          tabIndex={isPeekVisible ? 0 : -1}
          onStartResizing={onStartResizing}
          onToggleCollapsed={onToggleCollapsed}
          onKeyDown={onResizeKeyDown}
        />
      </div>
    </aside>
  );
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
  // hooks
  const { isMobile } = usePlatformOS();
  const { isResizing, startResizing, handleResizeKeyDown } = useSidebarResize({
    width,
    setWidth,
    minWidth,
    maxWidth,
  });
  const { handlePeekEnter, handlePeekLeave, toggleCollapsed } = usePeekSidebar({
    isCollapsed,
    showPeek,
    togglePeek,
    peekDuration,
    toggleCollapsedProp,
    isAnyExtendedSidebarExpanded,
    isAnySidebarDropdownOpen,
  });

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
      <MainSidebar
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        isResizing={isResizing}
        isAnyExtendedSidebarExpanded={isAnyExtendedSidebarExpanded}
        width={width}
        minWidth={minWidth}
        maxWidth={maxWidth}
        setWidth={setWidth}
        className={className}
        onStartResizing={startResizing}
        onToggleCollapsed={toggleCollapsed}
        onResizeKeyDown={handleResizeKeyDown}
      >
        {children}
      </MainSidebar>
      {/* Peek View */}
      <PeekSidebar
        isCollapsed={isCollapsed}
        showPeek={showPeek}
        isResizing={isResizing}
        isAnyExtendedSidebarExpanded={isAnyExtendedSidebarExpanded}
        width={width}
        minWidth={minWidth}
        maxWidth={maxWidth}
        setWidth={setWidth}
        onStartResizing={startResizing}
        onToggleCollapsed={toggleCollapsed}
        onResizeKeyDown={handleResizeKeyDown}
        onPeekEnter={handlePeekEnter}
        onPeekLeave={handlePeekLeave}
      >
        {children}
      </PeekSidebar>

      {/* Extended Sidebar */}
      {extendedSidebar}
    </>
  );
}
