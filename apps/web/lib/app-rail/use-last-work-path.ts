/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";

const storageKey = (workspaceSlug: string) => `APP_RAIL_LAST_WORK_PATH_${workspaceSlug}`;

const readStoredPath = (workspaceSlug: string): string | null => {
  try {
    return sessionStorage.getItem(storageKey(workspaceSlug));
  } catch {
    return null;
  }
};

/**
 * Remembers the last visited "work" page (anything outside the inbox and settings)
 * so the app rail's Projects item can take the user straight back to where they came from.
 */
export const useLastWorkPath = (): string => {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = workspaceSlug?.toString() ?? "";
  const fallback = `/${slug}/`;
  const query = searchParams?.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;
  const isWorkPath =
    !!slug &&
    pathname.startsWith(fallback) &&
    !pathname.includes(`/${slug}/notifications`) &&
    !pathname.includes(`/${slug}/settings`);

  useEffect(() => {
    if (!isWorkPath) return;
    try {
      sessionStorage.setItem(storageKey(slug), currentPath);
    } catch {
      // storage unavailable; Projects falls back to the workspace home
    }
  }, [isWorkPath, slug, currentPath]);

  if (isWorkPath) return currentPath;
  const lastPath = slug ? readStoredPath(slug) : null;
  return lastPath?.startsWith(fallback) ? lastPath : fallback;
};
