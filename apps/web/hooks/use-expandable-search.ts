/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOutsideClickDetector } from "@plane/hooks";

type UseExpandableSearchOptions = {
  onClose?: () => void;
};

/**
 * Custom hook for expandable search input behavior
 * Keeps focused input and visible results in sync for mouse, Tab and shortcuts.
 */
export const useExpandableSearch = (options?: UseExpandableSearchOptions) => {
  const { onClose } = options || {};

  // states
  const [isOpen, setIsOpen] = useState(false);

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    inputRef.current?.blur();
    onClose?.();
  }, [onClose]);

  // Outside click handler - memoized to prevent unnecessary re-registrations
  const handleOutsideClick = useCallback(() => {
    if (isOpen) {
      handleClose();
    }
  }, [isOpen, handleClose]);

  // Outside click detection. Capture phase so a mousedown handler that stops propagation
  // elsewhere on the page cannot keep the panel open.
  useOutsideClickDetector(containerRef, handleOutsideClick, true);

  // Escape closes the panel wherever focus is (e.g. after arrowing into the result list,
  // focus leaves the input and its own onKeyDown no longer fires).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Focus (including Tab and shortcuts) and repeated clicks must both expand results.
  const handleFocus = useCallback(() => setIsOpen(true), []);
  const handleMouseDown = handleFocus;

  // Helper to open panel (for typing/onChange)
  const openPanel = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  return {
    // State
    isOpen,
    setIsOpen,

    // Refs
    containerRef,
    inputRef,

    // Handlers
    handleClose,
    handleMouseDown,
    handleFocus,
    openPanel,
  };
};
