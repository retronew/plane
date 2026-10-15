/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Tooltip } from "@makeplane/propel/components/tooltip";

type TIssueLabelPill = { name?: string; color?: string };

export function LabelActivityChip(props: TIssueLabelPill) {
  const { name, color } = props;
  const dotColor = color?.trim();
  return (
    <Tooltip label={name ?? ""} layout="stacked">
      <span
        data-activity-part=""
        className="inline-flex max-w-32 flex-shrink-0 cursor-default items-center gap-1 rounded-full border border-strong px-1.5 text-11 leading-4 whitespace-nowrap"
      >
        {dotColor && (
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{
              backgroundColor: dotColor,
            }}
            aria-hidden="true"
          />
        )}
        <span className="flex-shrink truncate font-medium text-primary">{name}</span>
      </span>
    </Tooltip>
  );
}
