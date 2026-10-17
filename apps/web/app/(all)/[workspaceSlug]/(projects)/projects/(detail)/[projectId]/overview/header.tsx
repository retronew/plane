/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { IconButton } from "@makeplane/propel/components/icon-button";
import { OverviewOutline, RightSidePaneOutline } from "@makeplane/propel/icons";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
import { useTranslation } from "@plane/i18n";
// components
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
import { useProjectCrumbProps } from "@/components/breadcrumbs/use-project-crumb-props";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useProject } from "@/hooks/store/use-project";

export const ProjectOverviewHeader = observer(function ProjectOverviewHeader({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { workspaceSlug, projectId } = useParams();
  const projectCrumb = useProjectCrumbProps(workspaceSlug, projectId);
  const { loader } = useProject();
  const { t } = useTranslation();

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug} projectId={projectId} {...projectCrumb} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("common.overview")}
                href={`/${workspaceSlug}/projects/${projectId}/overview/`}
                icon={<OverviewOutline className="h-4 w-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <IconButton
          variant={sidebarOpen ? "tertiary" : "ghost"}
          size="sm"
          aria-label={t("web.toggle_sidebar")}
          aria-pressed={sidebarOpen}
          aria-expanded={sidebarOpen}
          aria-controls="project-overview-sidebar"
          onClick={onToggleSidebar}
          icon={<RightSidePaneOutline className="size-4" />}
        />
      </Header.RightItem>
    </Header>
  );
});
