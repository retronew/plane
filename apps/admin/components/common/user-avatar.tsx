/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn, getFileURL } from "@plane/utils";

type Props = {
  name?: string;
  avatarUrl?: string | null;
  className?: string;
};

/** Round user avatar, falling back to the first letter of the name */
export function UserAvatar({ name, avatarUrl, className }: Props) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-primary text-13 text-on-color uppercase",
        className
      )}
    >
      {avatarUrl ? (
        <img src={getFileURL(avatarUrl)} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        (name?.[0] ?? "?")
      )}
    </span>
  );
}
