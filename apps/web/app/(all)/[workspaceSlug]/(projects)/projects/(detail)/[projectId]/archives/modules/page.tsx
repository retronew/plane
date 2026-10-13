/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
import { observer } from "mobx-react";
// components
import { PageHead } from "@/components/core/page-title";
import { ArchivedModuleLayoutRoot, ArchivedModulesHeader } from "@/components/modules";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectArchivedModulesPage({ params }: Route.ComponentProps) {
  // router
  const { projectId } = params;
  // store hooks
  const { getProjectById } = useProject();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name && `${project?.name} - ${translate("web.title_archived_modules")}`;

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <ArchivedModulesHeader />
        <ArchivedModuleLayoutRoot />
      </div>
    </>
  );
}

export default observer(ProjectArchivedModulesPage);
