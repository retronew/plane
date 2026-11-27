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

export const ProjectPageRoot = observer(function ProjectPageRoot() {
  // router
  const { workspaceSlug } = useParams();
  // store
  const { currentWorkspace } = useWorkspace();
  const { fetchProjects, fetchStatus } = useProject();
  // Skip redundant /projects/details/ fetch if workspace bootstrap already hydrated full projects
  useSWR(
    workspaceSlug && currentWorkspace && fetchStatus !== "complete" ? `WORKSPACE_PROJECTS_${workspaceSlug}` : null,
    workspaceSlug && currentWorkspace ? () => fetchProjects(workspaceSlug.toString()) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  return <ProjectRoot />;
});
