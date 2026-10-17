/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
// plane imports
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import type { EViewAccess, TViewFilterProps } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { calculateTotalFilters } from "@plane/utils";
// components
import { PageHead } from "@/components/core/page-title";
import { ViewAppliedFiltersList } from "@/components/views/applied-filters";
import { ProjectViewsList } from "@/components/views/views-list";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectViewsPage({ params }: Route.ComponentProps) {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = params;
  // plane hooks
  const { t } = useTranslation();
  // store
  const { getProjectById, currentProjectDetails } = useProject();
  const { filters, updateFilters, clearAllFilters } = useProjectView();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name
    ? translate("web.runtime.page_title", { name: project?.name, section: translate("web.title_views") })
    : undefined;
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);

  const handleRemoveFilter = useCallback(
    (key: keyof TViewFilterProps, value: string | EViewAccess | null) => {
      let newValues = filters.filters?.[key];

      if (key === "favorites") {
        newValues = !!value;
      }
      if (Array.isArray(newValues)) {
        if (!value) newValues = [];
        else newValues = newValues.filter((val) => val !== value) as string[];
      }

      updateFilters("filters", { [key]: newValues });
    },
    [filters.filters, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters?.filters ?? {}) !== 0;

  // No access to
  if (currentProjectDetails?.issue_views_view === false)
    return (
      <EmptyStateDetailed
        assetKey="view"
        rootClassName="min-h-full overflow-y-auto px-6 py-10"
        title={t("disabled_project.empty_state.view.title")}
        description={t("disabled_project.empty_state.view.description")}
        actions={[
          {
            label: t("disabled_project.empty_state.view.primary_button.text"),
            onClick: () => router.push(`/${workspaceSlug}/settings/projects/${projectId}/features/views`),
            disabled: !canPerformEmptyStateActions,
          },
        ]}
      />
    );

  return (
    <>
      <PageHead title={pageTitle} />
      {isFiltersApplied && (
        <Header variant={EHeaderVariant.TERNARY}>
          <ViewAppliedFiltersList
            appliedFilters={filters.filters ?? {}}
            handleClearAllFilters={clearAllFilters}
            handleRemoveFilter={handleRemoveFilter}
            alwaysAllowEditing
          />
        </Header>
      )}
      <ProjectViewsList />
    </>
  );
}

export default observer(ProjectViewsPage);
