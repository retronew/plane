/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const useTableKeyboardNavigation = (navigateOffscreen?: (index: number, column: number) => void) => {
  return (event: React.KeyboardEvent<HTMLTableElement>) => {
    const element = event.target as HTMLTableCellElement;
    if (element.tagName !== "TD" && element.tagName !== "TH") return;
    let next: HTMLElement | undefined;
    if (event.key === "ArrowRight") next = element.nextElementSibling as HTMLElement | undefined;
    else if (event.key === "ArrowLeft") next = element.previousElementSibling as HTMLElement | undefined;
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const row = element.closest("tr");
      const column = element.cellIndex ?? Array.from(element.parentElement?.children ?? []).indexOf(element);
      const rows = Array.from(
        event.currentTarget.querySelectorAll<HTMLTableRowElement>("tr:not([data-virtual-spacer])")
      );
      const candidate = rows[rows.indexOf(row as HTMLTableRowElement) + direction];
      const currentIndex = Number(row?.closest<HTMLElement>("[data-virtual-index]")?.dataset.virtualIndex);
      const nextIndex = Number(candidate?.closest<HTMLElement>("[data-virtual-index]")?.dataset.virtualIndex);
      // A pinned focused row may be far from the current scroll window.
      if (
        navigateOffscreen &&
        Number.isFinite(currentIndex) &&
        (!candidate || Math.abs(nextIndex - currentIndex) > 1)
      ) {
        const targetIndex = currentIndex + direction;
        if (targetIndex >= 0) {
          event.preventDefault();
          navigateOffscreen(targetIndex, column);
          return;
        }
      }
      next = candidate?.cells[column];
    } else if (event.key === "Enter" || event.key === " " || event.key === "Space") {
      event.preventDefault();
      element.querySelector<HTMLElement>(".clickable")?.click();
      return;
    }
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
  };
};
