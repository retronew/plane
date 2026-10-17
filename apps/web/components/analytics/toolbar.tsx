/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TabsList } from "@makeplane/propel/components/tabs";
import type { AnalyticsTab } from "@plane/types";
import { UnderlineTabLink } from "@/components/navigation/underline-tab-link";
import AnalyticsFilterActions from "./analytics-filter-actions";

type Props = {
  workspaceSlug: string;
  tabs: Pick<AnalyticsTab, "key" | "label" | "isDisabled">[];
};

export function AnalyticsToolbar({ workspaceSlug, tabs }: Props) {
  return (
    <div className="flex min-h-12 w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-0 border-b border-subtle bg-surface-1 px-6">
      <div className="min-w-0 self-end overflow-x-auto">
        <TabsList>
          {tabs.map((tab) => (
            <UnderlineTabLink
              key={tab.key}
              value={tab.key}
              disabled={tab.isDisabled}
              label={tab.label}
              to={`/${workspaceSlug}/analytics/${tab.key}/`}
            />
          ))}
        </TabsList>
      </div>
      <div className="max-w-full shrink-0 py-2">
        <AnalyticsFilterActions />
      </div>
    </div>
  );
}
