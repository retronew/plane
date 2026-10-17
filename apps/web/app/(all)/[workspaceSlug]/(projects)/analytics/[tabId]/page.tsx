/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
// plane package imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { TabsPanel } from "@makeplane/propel/components/tabs";
// components
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { AnalyticsToolbar } from "@/components/analytics/toolbar";
import { PageHead } from "@/components/core/page-title";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { useAnalyticsTabs } from "@/components/analytics/use-analytics-tabs";
import type { Route } from "./+types/page";

function AnalyticsPage({ params }: Route.ComponentProps) {
  const { tabId } = params;

  // hooks
  const router = useRouter();

  // plane imports
  const { t } = useTranslation();

  // store hooks
  const { toggleCreateProjectModal } = useCommandPalette();
  const { workspaceProjectIds, loader } = useProject();
  const { currentWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();

  const pageTitle = currentWorkspace?.name
    ? t(`workspace_analytics.page_label`, { workspace: currentWorkspace?.name })
    : undefined;

  // permissions
  const canPerformEmptyStateActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const workspaceSlug = params.workspaceSlug;
  const ANALYTICS_TABS = useAnalyticsTabs(workspaceSlug.toString());

  const selectedTab = ANALYTICS_TABS.find((tab) => tab.key === tabId)?.key ?? "overview";
  useEffect(() => {
    if (!ANALYTICS_TABS.some((tab) => tab.key === tabId)) router.replace(`/${workspaceSlug}/analytics/overview/`);
  }, [ANALYTICS_TABS, tabId, workspaceSlug, router]);

  return (
    <>
      <PageHead title={pageTitle} />
      {workspaceProjectIds && (
        <>
          {workspaceProjectIds.length > 0 || loader === "init-loader" ? (
            <div className="flex h-full overflow-hidden">
              <AnimatedUnderlineTabs
                animatePanels={false}
                className="h-full min-h-0 [&>div]:h-full [&>div]:min-h-0 [&>div]:gap-0"
                value={selectedTab}
                motionKey={`/${workspaceSlug}/analytics`}
              >
                <div className="flex h-full min-h-0 w-full flex-col">
                  <AnalyticsToolbar workspaceSlug={workspaceSlug} tabs={ANALYTICS_TABS} />
                  {/* Grid wrapper: Propel's TabsPanel omits className, so the single mounted panel
                      gets its fill height from a one-row grid instead. */}
                  <div
                    key={`${workspaceSlug}:${selectedTab}`}
                    className="grid min-h-0 w-full flex-1 grid-rows-1 overflow-x-hidden overflow-y-auto"
                  >
                    {ANALYTICS_TABS.map((tab) => (
                      <TabsPanel key={tab.key} value={tab.key}>
                        <tab.content />
                      </TabsPanel>
                    ))}
                  </div>
                </div>
              </AnimatedUnderlineTabs>
            </div>
          ) : (
            <EmptyStateDetailed
              assetKey="project"
              title={t("workspace_projects.empty_state.no_projects.title")}
              description={t("workspace_projects.empty_state.no_projects.description")}
              actions={[
                {
                  label: t("web.create_a_project"),
                  onClick: () => {
                    toggleCreateProjectModal(true);
                  },
                  disabled: !canPerformEmptyStateActions,
                },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}

export default observer(AnalyticsPage);
