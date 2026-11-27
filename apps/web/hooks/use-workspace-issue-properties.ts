/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
import useSWR from "swr";
// plane web imports
import { useWorkspaceIssuePropertiesExtended } from "@/hooks/use-workspace-issue-properties-extended";
import { hydrateWorkspaceViewBootstrap } from "@/lib/bootstrap-cache";
import { StoreContext } from "@/lib/store-context";
import { bootstrapService } from "@/services/bootstrap.service";

export const useWorkspaceIssueProperties = (workspaceSlug: string | string[] | undefined) => {
  const rootStore = useContext(StoreContext);
  const slug = workspaceSlug ? workspaceSlug.toString() : undefined;

  // Single aggregated view bootstrap (merges views, modules, cycles, labels, estimates: 5 -> 1)
  const { isLoading } = useSWR(
    slug ? `WORKSPACE_VIEW_BOOTSTRAP_${slug}` : null,
    async () => {
      if (!slug) return null;
      const data = await bootstrapService.getWorkspaceViewBootstrap(slug);
      if (rootStore) hydrateWorkspaceViewBootstrap(rootStore, slug, data);
      return data;
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // fetch extended issue properties
  useWorkspaceIssuePropertiesExtended(workspaceSlug);

  return { isLoading };
};
