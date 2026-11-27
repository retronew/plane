/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// components
import { ProjectRoot } from "@/components/project/root";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { bootstrapService } from "@/services/bootstrap.service";

export const ProjectPageRoot = observer(function ProjectPageRoot() {
  // router
  const { workspaceSlug } = useParams();
  // store
  const { currentWorkspace } = useWorkspace();
  const { fetchProjects, fetchStatus } = useProject();
  const slug = workspaceSlug?.toString();
  // Skip redundant /projects/details/ fetch when workspace bootstrap already hydrated or is currently fetching full projects
  const shouldFetchFullProjects = Boolean(
    slug && currentWorkspace && fetchStatus !== "complete" && !bootstrapService.isFullWorkspaceBootstrapInflight(slug)
  );
  useSWR(shouldFetchFullProjects ? `WORKSPACE_PROJECTS_${slug}` : null, slug ? () => fetchProjects(slug) : null, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  return <ProjectRoot />;
});
