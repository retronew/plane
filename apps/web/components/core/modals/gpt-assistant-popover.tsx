/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { toSideAndAlign } from "@plane/blocks/common";
import type { TPopoverMenuPlacement } from "@plane/blocks/common";
import { WritingAssistant } from "@/components/ai/writing-assistant";
import type { WritingContext, WritingMode } from "@/components/ai/writing";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  getContext: () => WritingContext;
  onApply: (html: string, mode: WritingMode, context: WritingContext) => boolean;
  onUndo: (context: WritingContext) => void;
  placement?: TPopoverMenuPlacement;
  button: React.ReactNode;
  workspaceSlug: string;
};

export function GptAssistantPopover(props: Props) {
  const { isOpen, handleClose, button, placement, ...writingProps } = props;
  const { side, align } = toSideAndAlign(placement ?? "auto");
  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <PopoverTrigger
        nativeButton={false}
        openOnClick={false}
        tabIndex={-1}
        render={<span className="flex items-center" />}
      >
        {button}
      </PopoverTrigger>
      <PopoverContent variant="rich" side={side} align={align}>
        {isOpen && <WritingAssistant {...writingProps} onClose={handleClose} />}
      </PopoverContent>
    </Popover>
  );
}
