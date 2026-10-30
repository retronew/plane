/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { Fragment, useCallback, useEffect, useState } from "react";
// plane imports
import {
  ContextMenu as PropelContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
} from "@makeplane/propel/components/context-menu";
import { usePlatformOS } from "@plane/hooks";
// local imports
import { ContextMenuItem } from "./context-menu-item";
import { getRenderableItems, hasMenuSeparatorBefore, stopClickPropagation } from "./helpers";
import type { TContextMenuItem } from "./types";

export type ContextMenuProps = {
  /** The element whose right clicks open the menu. Owned by the consumer, not by this component. */
  parentRef: React.RefObject<HTMLElement | null>;
  /** The rows to render, top to bottom. */
  items: TContextMenuItem[];
  /** Called with the next open state whenever the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Base UI marks everything outside a modal menu `data-base-ui-inert`; its backdrop is the one such
 * element that is empty. Skip it and the popup itself to find what the cursor is really over.
 */
const isMenuOverlay = (element: Element) =>
  !!element.closest("[role='menu']") || (element.hasAttribute("data-base-ui-inert") && element.childElementCount === 0);

const findElementUnderOverlay = (x: number, y: number) =>
  document.elementsFromPoint?.(x, y).find((element) => !isMenuOverlay(element));

/**
 * A control inside the parent that opens its own popup — a card's state, label or date pill. Like
 * Linear, right-clicking one opens that picker rather than the parent's menu.
 */
export const findPopupTrigger = (target: EventTarget | null, parentElement: HTMLElement) => {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest<HTMLElement>("[aria-haspopup]:not([aria-haspopup='false'])");
  if (!trigger || trigger === parentElement || !parentElement.contains(trigger)) return null;
  if (trigger.matches(":disabled, [aria-disabled='true'], [data-disabled]")) return null;
  return trigger;
};

/**
 * Replays a right click as the primary-button press a picker listens for. Base UI triggers open on
 * different events (mousedown for a combobox, click for a popover), so send the whole sequence.
 */
const pressAsPrimary = (element: HTMLElement, source: MouseEvent) => {
  const init = { bubbles: true, cancelable: true, button: 0, clientX: source.clientX, clientY: source.clientY };
  const PointerCtor = typeof PointerEvent === "undefined" ? MouseEvent : PointerEvent;
  element.dispatchEvent(new PointerCtor("pointerdown", { ...init, pointerType: "mouse" }));
  element.dispatchEvent(new MouseEvent("mousedown", init));
  element.dispatchEvent(new PointerCtor("pointerup", { ...init, pointerType: "mouse" }));
  element.dispatchEvent(new MouseEvent("mouseup", init));
  element.dispatchEvent(new MouseEvent("click", init));
};

/** A virtual anchor pinned to a cursor position — Base UI's positioner reads `getBoundingClientRect`. */
const createCursorAnchor = (x: number, y: number) => ({
  getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
});

/** Right clicks a menu handed on to the element under its backdrop; every open menu lets them through. */
const redispatchedEvents = new WeakSet<Event>();

/**
 * The right-click menu Plane's boards, lists and tables share. Takes the same `{ parentRef, items }`
 * contract as the retired UI package's `ContextMenu` and renders it with Propel's context-menu parts.
 *
 * Propel's `ContextMenuTrigger` wants to own its right-click target, but this contract hands us a
 * ref to an element the consumer already rendered — so the `contextmenu` listener and the
 * cursor-pinned virtual anchor stay here, and the surface is driven as a controlled menu.
 */
export function ContextMenu(props: ContextMenuProps) {
  const { parentRef, items, onOpenChange } = props;
  // states
  const [isOpen, setIsOpenState] = useState(false);
  const setIsOpen = useCallback(
    (open: boolean) => {
      setIsOpenState(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );
  // Every right click swaps in a fresh anchor so Base UI re-positions the popup even while it is
  // already open — like Linear, the menu follows the cursor on each right click.
  const [anchor, setAnchor] = useState(() => createCursorAnchor(0, 0));
  // derived values
  const renderedItems = getRenderableItems(items);
  const { isMobile } = usePlatformOS();

  // The consumers own the right-click target (passed as `parentRef`), so capture its `contextmenu`
  // events to record the cursor position and open the menu.
  useEffect(() => {
    const parentElement = parentRef.current;
    if (!parentElement) return;

    const handleContextMenu = (e: MouseEvent) => {
      if (isMobile) return;

      e.preventDefault();
      e.stopPropagation();

      const popupTrigger = findPopupTrigger(e.target, parentElement);
      if (popupTrigger) {
        setIsOpen(false);
        pressAsPrimary(popupTrigger, e);
        return;
      }

      setAnchor(createCursorAnchor(e.clientX, e.clientY));
      setIsOpen(true);
    };

    parentElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      parentElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isMobile, parentRef, setIsOpen]);

  // While open, Base UI's modal backdrop covers the page, so another right click lands on the backdrop
  // (or the menu) rather than on a consumer's target and the browser's own menu would show. Swallow it
  // and hand the click to whatever sits under the cursor, so that element's menu opens there instead.
  useEffect(() => {
    if (!isOpen) return;

    const handleOverlayContextMenu = (e: MouseEvent) => {
      // the click this handler re-dispatches below must reach its new target untouched
      if (redispatchedEvents.has(e)) return;
      const target = e.target instanceof Element ? e.target : null;
      // a right click on the parent itself re-anchors through the listener above
      if (target && parentRef.current?.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);

      const underlying = findElementUnderOverlay(e.clientX, e.clientY);
      if (!underlying) return;
      const { clientX, clientY, screenX, screenY } = e;
      requestAnimationFrame(() => {
        const handOff = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX,
          clientY,
          screenX,
          screenY,
        });
        redispatchedEvents.add(handOff);
        underlying.dispatchEvent(handOff);
      });
    };

    document.addEventListener("contextmenu", handleOverlayContextMenu, true);
    return () => document.removeEventListener("contextmenu", handleOverlayContextMenu, true);
  }, [isOpen, parentRef, setIsOpen]);

  return (
    <PropelContextMenu open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenuContent anchor={anchor} side="bottom" align="start" sideOffset={0} onClick={stopClickPropagation}>
        {renderedItems.map((item, index) => (
          <Fragment key={item.key}>
            {hasMenuSeparatorBefore(renderedItems, index) && <ContextMenuSeparator />}
            <ContextMenuItem item={item} />
          </Fragment>
        ))}
      </ContextMenuContent>
    </PropelContextMenu>
  );
}

ContextMenu.displayName = "blocks.ContextMenu";
