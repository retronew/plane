/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { formatShortcutForDisplay } from "./format-shortcut";

export function ShortcutBadge({ shortcut }: { shortcut: string | undefined }) {
  const { platform } = usePlatformOS();
  const labels = formatShortcutForDisplay(shortcut, platform === "MacOS");
  if (labels.length === 0) return null;

  return (
    <div className="pointer-events-none inline-flex shrink-0 items-center gap-1 font-medium select-none">
      {labels.map((label, index) => (
        <kbd
          // oxlint-disable-next-line react/no-array-index-key -- static constant list; the index keeps repeated labels unique
          key={`${label}-${index}`}
          className="inline-flex h-5 items-center justify-center rounded-sm border border-strong bg-surface-1 px-1.5 font-code text-10 font-medium text-tertiary"
        >
          {label}
        </kbd>
      ))}
    </div>
  );
}

type TKeySequenceBadgeProps = {
  sequence: string | undefined;
  /** Translated connector rendered between keys, e.g. "then" in "G then M" */
  separator: string;
};

export function KeySequenceBadge({ sequence, separator }: TKeySequenceBadgeProps) {
  if (!sequence) return null;

  const chars = sequence.split("");

  return (
    <div className="pointer-events-none inline-flex shrink-0 items-center gap-1 font-medium select-none">
      {chars.map((char, index) => (
        // oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- static constant string; the index keeps repeated keys unique
        <React.Fragment key={`${char}-${index}`}>
          <kbd className="inline-flex h-5 items-center justify-center rounded-sm border border-strong bg-surface-1 px-1.5 font-code text-10 font-medium text-tertiary">
            {char.toUpperCase()}
          </kbd>
          {index < chars.length - 1 && <span className="text-10 text-placeholder">{separator}</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
