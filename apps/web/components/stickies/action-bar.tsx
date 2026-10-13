/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane hooks
import { useOutsideClickDetector } from "@plane/hooks";
// plane ui
import { AddOutline, CloseOutline, MultipleStickyOutline, StickyNoteOutline } from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// plane utils
import { cn } from "@plane/utils";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useSticky } from "@/hooks/use-stickies";
// components
import { AllStickiesModal } from "./modal";
import { StickyNote } from "./sticky";
import { translate } from "@plane/i18n";

const railButton =
  "flex size-8 items-center justify-center rounded-full text-tertiary hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none";

export const StickyActionBar = observer(function StickyActionBar() {
  // states
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSticky, setNewSticky] = useState(false);
  // navigation
  const { workspaceSlug } = useParams();
  // refs
  const ref = useRef(null);
  // store hooks
  const { activeStickyId, updateActiveStickyId, toggleShowNewSticky } = useSticky();
  const { toggleAllStickiesModal, allStickiesModal } = useCommandPalette();

  useOutsideClickDetector(ref, () => {
    setNewSticky(false);
    setIsExpanded(false);
  });

  return (
    <div ref={ref} className="relative flex flex-col items-center rounded-full border border-subtle bg-surface-1 p-1">
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="flex min-h-0 flex-col items-center gap-1 overflow-hidden">
          {[
            <Tooltip key="all" label={translate("web.all_stickies")} side="right">
              <button className={railButton} onClick={() => toggleAllStickiesModal(true)}>
                <MultipleStickyOutline className="size-5 rotate-90 text-tertiary" />
              </button>
            </Tooltip>,
            <Tooltip key="add" label={translate("web.add_sticky")} side="right">
              <button
                className={railButton}
                onClick={() => {
                  updateActiveStickyId("");
                  toggleShowNewSticky(true);
                  setNewSticky(true);
                }}
              >
                <AddOutline className="size-5 text-tertiary" />
              </button>
            </Tooltip>,
          ].map((item, index, items) => (
            // Items fade and rise in one after another as the column unfurls.
            <span
              key={item.key}
              className={cn(
                "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                { "pb-1": index === items.length - 1 },
                isExpanded ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.85] opacity-0"
              )}
              style={{ transitionDelay: isExpanded ? `${20 + 40 * (items.length - index)}ms` : "0ms" }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <button
        className={railButton}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? translate("web.close") : translate("web.your_stickies")}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <CloseOutline className="size-5 text-tertiary" />
        ) : (
          <StickyNoteOutline className="size-5 rotate-90 text-tertiary" />
        )}
      </button>

      <div
        className={cn(
          "absolute bottom-0 left-full z-[20] ml-3",
          "transform transition-all duration-300 ease-in-out",
          newSticky ? "min-h-[300px] translate-x-0 opacity-100" : "h-0 -translate-x-2 opacity-0"
        )}
      >
        {newSticky && (
          <StickyNote
            className={"w-[290px]"}
            onClose={() => setNewSticky(false)}
            workspaceSlug={workspaceSlug.toString()}
            stickyId={activeStickyId}
          />
        )}
      </div>

      <AllStickiesModal isOpen={allStickiesModal} handleClose={() => toggleAllStickiesModal(false)} />
    </div>
  );
});
