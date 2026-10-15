/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
// helpers
import { getCoverImageDisplayURL } from "@/helpers/cover-image.helper";

type TCoverImageProps = {
  /** The cover image URL - can be uploaded or external */
  src: string | null | undefined;
  /** Alt text for the image */
  alt?: string;
  /** Additional className for the image or fallback */
  className?: string;
  /** Optional caller-owned fallback image. Empty covers use a static dark background. */
  fallbackUrl?: string | null;
} & React.ComponentProps<"img">;

/** Display uploaded covers; empty covers use the same static dark background everywhere. */
export function CoverImage(props: TCoverImageProps) {
  const { src, alt = "Cover image", className, fallbackUrl = null, ...restProps } = props;

  const displayUrl = getCoverImageDisplayURL(src, fallbackUrl ?? null);
  if (!displayUrl) return <div className={cn("bg-[#262626]", className)} />;

  return <img src={displayUrl} alt={alt} className={cn("object-cover", className)} {...restProps} />;
}
