/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

type TArgs = {
  elementId: string;
  pathname: string;
  scrollDelay?: number;
};

type TReturnType = {
  isHashMatch: boolean;
  hashIds: string[];
  scrollToElement: () => boolean;
};

/**
 * Extracts multiple IDs from hash string
 * Supports various delimiters: comma, space, pipe, semicolon
 * @param {string} hashString - The hash part of the URL
 * @returns {string[]} - Array of clean ID strings
 */
const extractIdsFromHash = (hashString: string | null): string[] => {
  if (!hashString) return [];

  // Split by common delimiters and clean up
  return hashString
    .split(/[,\s|;]+/) // Split by comma, space, pipe, or semicolon
    .map((id) => id.trim()) // Remove whitespace
    .filter((id) => id.length > 0); // Remove empty strings
};

/**
 * Get current hash from window.location
 * @returns {string | null} - Current hash without the # symbol
 */
const getCurrentHash = (): string | null => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  return hash ? hash.slice(1) : null; // Remove the # symbol
};

const subscribeToHash = (onStoreChange: () => void) => {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
};

const getServerHash = () => null;

/**
 * Custom hook for handling hash-based scrolling to a specific element
 * Supports multiple IDs in URL hash (comma-separated, space-separated, or other delimiters)
 *
 * @param {TArgs} args - The ID of the element to scroll to
 * @returns {TReturnType} Object containing hash match status and scroll function
 */
export const useHashScroll = (args: TArgs): TReturnType => {
  const { elementId, pathname, scrollDelay = 200 } = args;
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hash = useSyncExternalStore(subscribeToHash, getCurrentHash, getServerHash);
  const hashIds = useMemo(() => (elementId ? extractIdsFromHash(hash) : []), [elementId, hash]);
  const isHashMatch = hashIds.includes(elementId);
  const scrollTarget = useMemo(() => ({ hash, pathname, isHashMatch }), [hash, pathname, isHashMatch]);

  /**
   * Scrolls to the element with the provided ID
   * @returns {boolean} - Whether the scroll was successful
   */
  const scrollToElement = useCallback((): boolean => {
    try {
      const element = document.getElementById(elementId);

      if (element) {
        if (scrollTimeout.current !== null) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
          element.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, scrollDelay);

        return true;
      }

      return false;
    } catch (error) {
      console.warn("Hash scroll error:", error);
      return false;
    }
  }, [elementId, scrollDelay]);

  useEffect(
    () => () => {
      if (scrollTimeout.current !== null) clearTimeout(scrollTimeout.current);
    },
    []
  );

  // Scroll on hash matches and route changes.
  useEffect(() => {
    if (scrollTarget.isHashMatch) scrollToElement();
  }, [scrollTarget, scrollToElement]);

  // Return object with hash match status and utility functions
  return {
    // Whether the current URL hash contains the provided element ID
    isHashMatch,

    // Array of all IDs found in the current hash
    hashIds,

    // Manually trigger scroll to the element
    scrollToElement,
  };
};
