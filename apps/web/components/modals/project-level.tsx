/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
import { observer } from "mobx-react";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
// plane web hooks
import { EPageStoreType } from "@/hooks/store";

const CycleCreateUpdateModal = lazy(() =>
  import("@/components/cycles/modal").then((m) => ({ default: m.CycleCreateUpdateModal }))
);
const CreateUpdateModuleModal = lazy(() =>
  import("@/components/modules").then((m) => ({ default: m.CreateUpdateModuleModal }))
);
const CreatePageModal = lazy(() =>
  import("@/components/pages/modals/create-page-modal").then((m) => ({ default: m.CreatePageModal }))
);
const CreateUpdateProjectViewModal = lazy(() =>
  import("@/components/views/modal").then((m) => ({ default: m.CreateUpdateProjectViewModal }))
);

export type TProjectLevelModalsProps = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectLevelModals = observer(function ProjectLevelModals(props: TProjectLevelModalsProps) {
  const { workspaceSlug, projectId } = props;
  // store hooks
  const {
    isCreateCycleModalOpen,
    toggleCreateCycleModal,
    isCreateModuleModalOpen,
    toggleCreateModuleModal,
    isCreateViewModalOpen,
    toggleCreateViewModal,
    createPageModal,
    toggleCreatePageModal,
  } = useCommandPalette();

  if (!isCreateCycleModalOpen && !isCreateModuleModalOpen && !isCreateViewModalOpen && !createPageModal.isOpen) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {isCreateCycleModalOpen && (
        <CycleCreateUpdateModal
          isOpen={isCreateCycleModalOpen}
          handleClose={() => toggleCreateCycleModal(false)}
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
        />
      )}
      {isCreateModuleModalOpen && (
        <CreateUpdateModuleModal
          isOpen={isCreateModuleModalOpen}
          onClose={() => toggleCreateModuleModal(false)}
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
        />
      )}
      {isCreateViewModalOpen && (
        <CreateUpdateProjectViewModal
          isOpen={isCreateViewModalOpen}
          onClose={() => toggleCreateViewModal(false)}
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
        />
      )}
      {createPageModal.isOpen && (
        <CreatePageModal
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
          isModalOpen={createPageModal.isOpen}
          pageAccess={createPageModal.pageAccess}
          handleModalClose={() => toggleCreatePageModal({ isOpen: false })}
          redirectionEnabled
          storeType={EPageStoreType.PROJECT}
        />
      )}
    </Suspense>
  );
});
