/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unstable_serialize, useSWRConfig } from "swr";
import { projectOverviewKey } from "@/services/project/project-overview.service";

export function useRefreshProjectActivities(workspaceSlug: string, projectId: string) {
  const { cache, mutate } = useSWRConfig();
  return async () => {
    const activityKey = projectOverviewKey(workspaceSlug, projectId, "activities");
    const infinitePrefix = `$inf$${unstable_serialize(activityKey)}`;
    const infiniteKeys = Array.from(cache.keys()).filter((key) => key.startsWith(infinitePrefix));
    await Promise.allSettled([
      mutate(
        (key) =>
          Array.isArray(key) &&
          key[0] === activityKey[0] &&
          key[1] === workspaceSlug &&
          key[2] === projectId &&
          key[3] === "activities"
      ),
      ...infiniteKeys.map((key) => mutate(key)),
    ]);
  };
}
