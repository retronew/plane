/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { isTemplateAvailable } from "@/components/settings/workspace/configuration/template-application";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import {
  configurationKey,
  workspaceConfigurationService,
  type WorkspaceTemplate,
} from "@/services/workspace-configuration.service";
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
// constants
import { EPageAccess } from "@plane/constants";
// plane types
import { Button } from "@makeplane/propel/components/button";
import { PagesOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import type { TPage } from "@plane/types";
// plane ui
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// helpers
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
import { useProjectCrumbProps } from "@/components/breadcrumbs/use-project-crumb-props";
import { EPageStoreType, usePageStore } from "@/hooks/store";
import { translate } from "@plane/i18n";

export const PagesListHeader = observer(function PagesListHeader() {
  // states
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug, projectId } = useParams();
  const { toggleCreatePageModal } = useCommandPalette();
  const slug = workspaceSlug?.toString() ?? "";
  const { data: templates } = useSWR(slug ? configurationKey(slug, "templates") : null, () =>
    workspaceConfigurationService.list<WorkspaceTemplate>(slug, "templates")
  );
  const projectCrumb = useProjectCrumbProps(workspaceSlug?.toString(), projectId?.toString());
  const searchParams = useSearchParams();
  const pageType = searchParams.get("type");
  // store hooks
  const { currentProjectDetails, loader } = useProject();
  const { canCurrentUserCreatePage, createPage } = usePageStore(EPageStoreType.PROJECT);
  // handle page create
  const handleCreatePage = async () => {
    setIsCreatingPage(true);

    const payload: Partial<TPage> = {
      access: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
    };

    await createPage(payload, { addToStore: false })
      .then((res) => {
        if (res?.id) router.push(`/${workspaceSlug}/projects/${projectId}/pages/${res.id}`);
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: err?.data?.error || translate("web.page_could_not_be_created_please_try_again"),
        });
      })
      .finally(() => setIsCreatingPage(false));
  };

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs
            workspaceSlug={workspaceSlug?.toString()}
            projectId={projectId?.toString()}
            {...projectCrumb}
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={translate("web.pages")}
                href={`/${workspaceSlug}/projects/${currentProjectDetails?.id}/pages/`}
                icon={<PagesOutline className="h-4 w-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      {canCurrentUserCreatePage && (
        <Header.RightItem>
          {templates?.some((template) => isTemplateAvailable(template, "page", projectId?.toString())) && (
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={translate("web.create_from_template")}
              onClick={() =>
                toggleCreatePageModal({
                  isOpen: true,
                  pageAccess: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
                })
              }
            />
          )}
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={isCreatingPage ? translate("web.adding") : translate("web.add_page")}
            onClick={handleCreatePage}
            loading={isCreatingPage}
          />
        </Header.RightItem>
      )}
    </Header>
  );
});
