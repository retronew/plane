/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
// plane imports
import { useOutsideClickDetector } from "@plane/hooks";
import { ChevronDownOutline } from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// local imports
import type { TCustomImageAlignment } from "../../types";
import { IMAGE_ALIGNMENT_OPTIONS } from "../../utils";
import { translate } from "@plane/i18n";

type Props = {
  activeAlignment: TCustomImageAlignment;
  handleChange: (alignment: TCustomImageAlignment) => void;
  isTouchDevice: boolean;
  isDropdownOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImageAlignmentAction(props: Props) {
  const { activeAlignment, handleChange, isTouchDevice, isDropdownOpen, onOpenChange } = props;
  // refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  // derived values
  const activeAlignmentDetails = IMAGE_ALIGNMENT_OPTIONS.find((option) => option.value === activeAlignment);

  useOutsideClickDetector(dropdownRef, () => onOpenChange(false));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && isDropdownOpen) {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      dropdownRef.current?.querySelector("button")?.focus();
    }
  };

  return (
    <div ref={dropdownRef} className="relative h-full">
      <Tooltip disabled={isTouchDevice} label={translate("web.align")}>
        <button
          aria-label={translate("web.align")}
          type="button"
          className="flex h-full items-center gap-1 text-white/60 transition-colors hover:text-white"
          onKeyDown={handleKeyDown}
          aria-expanded={isDropdownOpen}
          onClick={() => onOpenChange(!isDropdownOpen)}
        >
          {activeAlignmentDetails && <activeAlignmentDetails.icon className="size-3 flex-shrink-0" />}
          <ChevronDownOutline className="size-2 flex-shrink-0" />
        </button>
      </Tooltip>
      {isDropdownOpen && (
        <div className="absolute top-full left-1/2 mt-0.5 flex h-7 -translate-x-1/2 items-center gap-2 rounded-sm bg-black/80 px-2">
          {IMAGE_ALIGNMENT_OPTIONS.map((option) => (
            <Tooltip disabled={isTouchDevice} key={option.value} label={option.label}>
              <button
                onKeyDown={handleKeyDown}
                aria-label={option.label}
                type="button"
                className="grid h-full flex-shrink-0 place-items-center text-white/60 transition-colors hover:text-white"
                onClick={() => {
                  handleChange(option.value);
                  onOpenChange(false);
                }}
              >
                <option.icon className="size-3" />
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
