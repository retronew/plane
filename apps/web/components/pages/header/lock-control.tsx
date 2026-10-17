/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { LockedOutline, UnlockedOutline } from "@makeplane/propel/icons";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
// hooks
import { usePageOperations } from "@/hooks/use-page-operations";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { translate } from "@plane/i18n";

// Define our lock display states, renaming "icon-only" to "neutral"
type LockDisplayState = "neutral" | "locked" | "unlocked";

type Props = {
  page: TPageInstance;
};

export const PageLockControl = observer(function PageLockControl({ page }: Props) {
  // Initial state: if locked, then "locked", otherwise default to "neutral"
  const [displayState, setDisplayState] = useState<LockDisplayState>(page.is_locked ? "locked" : "neutral");
  // derived values
  const { canCurrentUserLockPage, is_locked } = page;
  // Ref for the transition timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to store the previous value of isLocked for detecting transitions
  const prevLockedRef = useRef(is_locked);
  // page operations
  const {
    pageOperations: { toggleLock },
  } = usePageOperations({
    page,
  });

  // Cleanup any running timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Update display state when isLocked changes
  useEffect(() => {
    // Clear any previous timer to avoid overlapping transitions
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Transition logic:
    // If locked, ensure the display state is "locked"
    // If unlocked after being locked, show "unlocked" briefly then revert to "neutral"
    if (is_locked) {
      setDisplayState("locked");
    } else if (prevLockedRef.current === true) {
      setDisplayState("unlocked");
      timerRef.current = setTimeout(() => {
        setDisplayState("neutral");
        timerRef.current = null;
      }, 600);
    } else {
      setDisplayState("neutral");
    }

    // Update the previous locked state
    prevLockedRef.current = is_locked;
  }, [is_locked]);

  if (!canCurrentUserLockPage) return null;

  // Render different UI based on the current display state
  return (
    <>
      {displayState === "neutral" && (
        <Tooltip
          label={translate("web.lock")}
          side="top"
          positionMethod="fixed"
          collisionAvoidance={{ side: "none", align: "shift" }}
        >
          <button
            type="button"
            onClick={toggleLock}
            className="grid size-7 flex-shrink-0 place-items-center rounded-sm text-secondary transition-colors hover:bg-layer-1 hover:text-primary"
            aria-label={translate("web.lock")}
          >
            <LockedOutline className="size-4" />
          </button>
        </Tooltip>
      )}

      {displayState === "locked" && (
        <Tooltip
          label={translate("web.unlock")}
          side="top"
          positionMethod="fixed"
          collisionAvoidance={{ side: "none", align: "shift" }}
        >
          <button
            type="button"
            onClick={toggleLock}
            className="flex h-7 items-center gap-1 rounded-sm bg-accent-primary/20 px-2 text-accent-primary transition-colors hover:bg-accent-primary/30"
            aria-label={translate("web.locked")}
          >
            <LockedOutline className="animate-lock-icon size-4 flex-shrink-0" />
            <span className="animate-text-slide-in overflow-hidden text-11 font-medium whitespace-nowrap transition-all duration-500 ease-out">
              {translate("web.locked")}
            </span>
          </button>
        </Tooltip>
      )}

      {displayState === "unlocked" && (
        <div
          className="flex h-7 animate-fade-out items-center gap-1 rounded-sm px-2 text-secondary"
          aria-label={translate("web.unlocked")}
        >
          <UnlockedOutline className="animate-unlock-icon size-4 flex-shrink-0" />
          <span className="animate-text-slide-in animate-text-fade-out overflow-hidden text-11 font-medium whitespace-nowrap transition-all duration-500 ease-out">
            {translate("web.unlocked")}
          </span>
        </div>
      )}
    </>
  );
});
