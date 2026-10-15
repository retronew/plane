/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IGroupHeaderProps } from "@plane/types";

export function GroupHeader({ group, itemCount }: Pick<IGroupHeaderProps, "group" | "itemCount">) {
  return (
    <div className="flex w-full items-center gap-1 py-1.5 text-body-sm-medium text-primary">
      <span className="flex size-5 shrink-0 items-center justify-center">{group.icon}</span>
      <span className="min-w-0 truncate">{group.name}</span>
      <span className="pl-2 text-13 font-medium text-tertiary">{itemCount}</span>
    </div>
  );
}
