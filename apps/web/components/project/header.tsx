/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
import { useProject } from "@/hooks/store/use-project";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ChevronDown } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
// i18n
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Button } from "@makeplane/propel/components/button";
import { Badge } from "@makeplane/propel/components/badge";
import { ProjectsOutline } from "@makeplane/propel/icons";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUserPermissions } from "@/hooks/store/user";
// plane web constants
// components
import HeaderFilters from "./filters";
import { ProjectSearch } from "./search-projects";

export const ProjectsBaseHeader = observer(function ProjectsBaseHeader() {
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { toggleCreateProjectModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  const pathname = usePathname();
  const { workspaceSlug } = useParams();
  const { currentWorkspaceDisplayFilters, updateDisplayFilters } = useProjectFilter();
  const { filteredProjectIds } = useProject();
  // auth
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const isArchived = pathname.includes("/archives");

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("workspace_projects.label", { count: 2 })}
                icon={<ProjectsOutline className="h-4 w-4 text-tertiary" />}
              />
            }
          />
          {!isArchived && (
            <Breadcrumbs.Item
              component={
                <div className="flex items-center gap-1 [&>div]:w-auto">
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="xs"
                          stretch="auto"
                          label={t(
                            currentWorkspaceDisplayFilters?.my_projects
                              ? "web.project_page.your_projects"
                              : "web.project_page.all_projects"
                          )}
                          iconPosition="end"
                          icon={<ChevronDown className="size-3" />}
                        />
                      }
                    />
                    <MenuContent side="bottom" align="start">
                      <MenuRadioGroup
                        value={currentWorkspaceDisplayFilters?.my_projects ? "mine" : "all"}
                        onValueChange={(value) => {
                          if (workspaceSlug)
                            updateDisplayFilters(String(workspaceSlug), { my_projects: value === "mine" });
                        }}
                      >
                        <MenuRadioItem value="mine" label={t("web.project_page.your_projects")} />
                        <MenuRadioItem value="all" label={t("web.project_page.all_projects")} />
                      </MenuRadioGroup>
                    </MenuContent>
                  </Menu>
                  <Badge size="xs" variant="brand" label={String(filteredProjectIds?.length ?? 0)} />
                </div>
              }
            />
          )}
          {isArchived && <Breadcrumbs.Item component={<BreadcrumbLink label={t("web.archived")} />} />}
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <ProjectSearch />
        <div className="hidden md:flex">
          <HeaderFilters />
        </div>
        {isAuthorizedUser && !isArchived ? (
          <>
            <span className="hidden sm:inline-block">
              <Button
                variant="primary"
                size="md"
                stretch="auto"
                onClick={() => {
                  toggleCreateProjectModal(true);
                }}
                label={t("workspace_projects.create.label")}
              />
            </span>
            <span className="inline-block sm:hidden">
              <Button
                variant="primary"
                size="md"
                stretch="auto"
                onClick={() => {
                  toggleCreateProjectModal(true);
                }}
                label={t("workspace_projects.label", { count: 1 })}
              />
            </span>
          </>
        ) : (
          <></>
        )}
      </Header.RightItem>
    </Header>
  );
});
