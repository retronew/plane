/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { usePowerK } from "@/hooks/store/use-power-k";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web imports
import { ProjectLevelModals } from "@/components/modals/project-level";
import { WorkItemLevelModals } from "@/components/modals/work-item-level";
import { WorkspaceLevelModals } from "@/components/modals/workspace-level";
// local imports
import { useProjectsAppPowerKCommands } from "./config/commands";
import type { TPowerKCommandConfig, TPowerKContext } from "./core/types";
import { GlobalShortcutsProvider } from "./global-shortcuts";

const ProjectsAppPowerKModal = lazy(async () => {
  const [{ ProjectsAppPowerKModalWrapper }, { ProjectsAppPowerKCommandsList }] = await Promise.all([
    import("./ui/modal/wrapper"),
    import("./ui/modal/commands-list"),
  ]);
  return {
    default: function LazyProjectsAppPowerKModal(props: {
      context: TPowerKContext;
      isOpen: boolean;
      onClose: () => void;
    }) {
      return (
        <ProjectsAppPowerKModalWrapper
          commandsListComponent={ProjectsAppPowerKCommandsList}
          context={props.context}
          isOpen={props.isOpen}
          onClose={props.onClose}
        />
      );
    },
  };
});

/**
 * Projects App PowerK provider
 */
export const ProjectsAppPowerKProvider = observer(function ProjectsAppPowerKProvider() {
  // router
  const router = useAppRouter();
  const params = useParams();
  const { workspaceSlug, projectId: routerProjectId, workItem: workItemIdentifier } = params;
  // states
  const [activeCommand, setActiveCommand] = useState<TPowerKCommandConfig | null>(null);
  const [shouldShowContextBasedActions, setShouldShowContextBasedActions] = useState(true);
  // store hooks
  const { activeContext, isPowerKModalOpen, togglePowerKModal, setActivePage } = usePowerK();
  const { data: currentUser } = useUser();
  // derived values
  const {
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();
  // derived values
  const workItemId = workItemIdentifier ? getIssueIdByIdentifier(workItemIdentifier.toString()) : undefined;
  const workItemDetails = workItemId ? getIssueById(workItemId) : undefined;
  const projectId: string | string[] | undefined | null = routerProjectId ?? workItemDetails?.project_id;
  const commands = useProjectsAppPowerKCommands();
  // Build command context from props and store
  const context: TPowerKContext = useMemo(
    () => ({
      currentUserId: currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      setShouldShowContextBasedActions,
      params: {
        ...params,
        projectId,
      },
      router,
      closePalette: () => togglePowerKModal(false),
      setActiveCommand,
      setActivePage,
    }),
    [
      currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      params,
      projectId,
      router,
      togglePowerKModal,
      setActivePage,
    ]
  );

  return (
    <>
      <GlobalShortcutsProvider context={context} commands={commands} />
      {workspaceSlug && <WorkspaceLevelModals workspaceSlug={workspaceSlug.toString()} />}
      {workspaceSlug && projectId && (
        <ProjectLevelModals workspaceSlug={workspaceSlug.toString()} projectId={projectId.toString()} />
      )}
      <WorkItemLevelModals workItemIdentifier={workItemIdentifier?.toString()} />
      {isPowerKModalOpen && (
        <Suspense fallback={null}>
          <ProjectsAppPowerKModal
            context={context}
            isOpen={isPowerKModalOpen}
            onClose={() => togglePowerKModal(false)}
          />
        </Suspense>
      )}
    </>
  );
});
