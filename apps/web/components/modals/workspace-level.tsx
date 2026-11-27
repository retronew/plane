/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
import { observer } from "mobx-react";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";

const CreateProjectModal = lazy(() =>
  import("@/components/project/create-project-modal").then((m) => ({ default: m.CreateProjectModal }))
);

export type TWorkspaceLevelModalsProps = {
  workspaceSlug: string;
};

export const WorkspaceLevelModals = observer(function WorkspaceLevelModals(props: TWorkspaceLevelModalsProps) {
  const { workspaceSlug } = props;
  // store hooks
  const { isCreateProjectModalOpen, createProjectModalData, toggleCreateProjectModal } = useCommandPalette();

  if (!isCreateProjectModalOpen) return null;

  return (
    <Suspense fallback={null}>
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => toggleCreateProjectModal(false)}
        workspaceSlug={workspaceSlug.toString()}
        data={createProjectModalData}
      />
    </Suspense>
  );
});
