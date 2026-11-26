/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// The viewport root clips against both the vertical column and the horizontal board. A column
// root would report cards as visible even when their entire column is scrolled offscreen.
// Browsers without scrollMargin clip at the scrollport edge and still receive intersections.
// Prepare roughly three rows ahead of a fast wheel gesture without mounting adjacent columns.
const cardViewport = { root: null, scrollMargin: "480px 0px", threshold: [0, 0.0001] };

export function createCardObserver() {
  let observer: IntersectionObserver | undefined;
  const listeners = new Map<Element, (entry: IntersectionObserverEntry) => void>();
  const pending = new Map<Element, IntersectionObserverEntry>();
  let frame: number | undefined;
  // A scroll jump can expose an entire column of property editors at once. Give input
  // and paint a turn between mounts. The lightweight title is already on screen.
  function revealNext() {
    frame = undefined;
    const next = pending.values().next().value;
    if (!next) return;
    pending.delete(next.target);
    listeners.get(next.target)?.(next);
    if (pending.size) frame = requestAnimationFrame(revealNext);
  }
  return (row: HTMLElement, notify: (entry: IntersectionObserverEntry) => void) => {
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) pending.set(entry.target, entry);
        else {
          pending.delete(entry.target);
          listeners.get(entry.target)?.(entry);
        }
      }
      if (pending.size && frame === undefined) frame = requestAnimationFrame(revealNext);
    }, cardViewport);
    listeners.set(row, notify);
    observer.observe(row);
    return () => {
      observer?.unobserve(row);
      listeners.delete(row);
      pending.delete(row);
      if (!pending.size && frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
      if (!listeners.size) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  };
}

// Child layout effects run before ancestor refs are attached. Read the actual board and column
// scrollports from the DOM so the first visible cards don't wait for an observer delivery.
export function isInKanbanViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const board = element.closest(".horizontal-scrollbar")?.getBoundingClientRect();
  const column = element.closest(".vertical-scrollbar")?.getBoundingClientRect();
  return (
    rect.right > Math.max(0, board?.left ?? 0) &&
    rect.left < Math.min(window.innerWidth, board?.right ?? window.innerWidth) &&
    rect.bottom > Math.max(0, board?.top ?? 0, column?.top ?? 0) &&
    rect.top < Math.min(window.innerHeight, board?.bottom ?? window.innerHeight, column?.bottom ?? window.innerHeight)
  );
}
