import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
import { ExportOutline, MoreHorizontalOutline, StopCircleOutline } from "@makeplane/propel/icons";
// ui
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { FavoriteStarIcon } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import {
  ContextMenu,
  getRenderableItems,
  hasMenuSeparatorBefore,
  resolveItemVariant,
} from "@plane/blocks/context-menu";
import { copyUrlToClipboard } from "@plane/utils";
// hooks
import { useCycleMenuItems } from "@/components/common/quick-actions-helper";
import { useCycle } from "@/hooks/store/use-cycle";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { ArchiveCycleModal } from "./archived-cycles/modal";
import { CycleDeleteModal } from "./delete-modal";
import { CycleExportModal } from "./export-modal";
import { CycleCompleteModal } from "./complete-modal";
import { CycleCreateUpdateModal } from "./modal";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  cycleId: string;
  projectId: string;
  workspaceSlug: string;
  customClassName?: string;
};

function SelectedFavoriteIcon() {
  return <FavoriteStarIcon selected />;
}

function UnselectedFavoriteIcon() {
  return <FavoriteStarIcon selected={false} />;
}

export const CycleQuickActions = observer(function CycleQuickActions(props: Props) {
  const { parentRef, cycleId, projectId, workspaceSlug, customClassName } = props;
  // router
  const router = useAppRouter();
  // states
  const [updateModal, setUpdateModal] = useState(false);
  const [archiveCycleModal, setArchiveCycleModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getCycleById, restoreCycle, addCycleToFavorites, removeCycleFromFavorites } = useCycle();
  const { t } = useTranslation();
  const { setValue: toggleFavoriteMenu } = useLocalStorage<boolean>(IS_FAVORITE_MENU_OPEN, false);
  // derived values
  const cycleDetails = getCycleById(cycleId);
  // auth
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const cycleLink = `${workspaceSlug}/projects/${projectId}/cycles/${cycleId}`;
  const handleCopyText = () =>
    copyUrlToClipboard(cycleLink).then(() => {
      setToast({
        type: "success",
        title: t("common.link_copied"),
        message: t("common.link_copied_to_clipboard"),
      });
      return undefined;
    });
  const handleOpenInNewTab = () => window.open(`/${cycleLink}`, "_blank", "noopener,noreferrer");

  const handleRestoreCycle = async () =>
    await restoreCycle(workspaceSlug, projectId, cycleId)
      .then(() => {
        setToast({
          type: "success",
          title: t("project_cycles.action.restore.success.title"),
          message: t("project_cycles.action.restore.success.description"),
        });
        return router.push(`/${workspaceSlug}/projects/${projectId}/archives/cycles`);
      })
      .catch(() => {
        setToast({
          type: "error",
          title: t("project_cycles.action.restore.failed.title"),
          message: t("project_cycles.action.restore.failed.description"),
        });
      });

  const handleToggleFavorite = async () => {
    if (!isEditingAllowed || !cycleDetails || cycleDetails.archived_at) return;
    const action = cycleDetails.is_favorite ? "unfavorite" : "favorite";
    try {
      if (cycleDetails.is_favorite) await removeCycleFromFavorites(workspaceSlug, projectId, cycleId);
      else {
        await addCycleToFavorites(workspaceSlug, projectId, cycleId);
        toggleFavoriteMenu(true);
      }
      setToast({
        type: "success",
        title: t(`project_cycles.action.${action}.success.title`),
        message: t(`project_cycles.action.${action}.success.description`),
      });
    } catch {
      setToast({
        type: "error",
        title: t(`project_cycles.action.${action}.failed.title`),
        message: t(`project_cycles.action.${action}.failed.description`),
      });
    }
  };

  const menuResult = useCycleMenuItems({
    cycleDetails: cycleDetails ?? undefined,
    workspaceSlug,
    projectId,
    cycleId,
    isEditingAllowed,
    handleEdit: () => setUpdateModal(true),
    handleArchive: () => setArchiveCycleModal(true),
    handleRestore: handleRestoreCycle,
    handleDelete: () => setDeleteModal(true),
    handleCopyLink: handleCopyText,
    handleOpenInNewTab,
  });

  const cycleMenuItems: TContextMenuItem[] = Array.isArray(menuResult) ? menuResult : menuResult.items;
  const MENU_ITEMS: TContextMenuItem[] = [
    ...cycleMenuItems.filter((item) => !["delete", "archive", "restore"].includes(item.key)),
    {
      key: "favorite",
      title: t(cycleDetails?.is_favorite ? "remove_from_favorites" : "add_to_favorites"),
      icon: cycleDetails?.is_favorite ? SelectedFavoriteIcon : UnselectedFavoriteIcon,
      action: () => void handleToggleFavorite(),
      shouldRender: isEditingAllowed && !!cycleDetails && !cycleDetails.archived_at,
    },
    {
      key: "complete",
      title: t("project_cycles.complete.action"),
      icon: StopCircleOutline,
      action: () => setCompleteModal(true),
      shouldRender:
        isEditingAllowed &&
        cycleDetails?.status?.toLowerCase() === "current" &&
        !cycleDetails.archived_at &&
        !cycleDetails.completed_at,
    },
    {
      key: "export",
      title: t("export"),
      icon: ExportOutline,
      action: () => setExportModal(true),
      shouldRender:
        isEditingAllowed &&
        allowPermissions(
          [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
          EUserPermissionsLevel.WORKSPACE,
          workspaceSlug
        ),
    },
    ...cycleMenuItems.filter((item) => ["archive", "restore", "delete"].includes(item.key)),
  ];
  const additionalModals = Array.isArray(menuResult) ? null : menuResult.modals;

  const renderedItems = getRenderableItems(MENU_ITEMS).map((item) =>
    Object.assign({}, item, {
      section: ["archive", "restore", "delete"].includes(item.key) ? "lifecycle" : "actions",
      variant: item.key === "delete" ? ("danger" as const) : ("neutral" as const),
    })
  );

  return (
    <>
      {cycleDetails && (
        <div className="fixed">
          <CycleCreateUpdateModal
            data={cycleDetails}
            isOpen={updateModal}
            handleClose={() => setUpdateModal(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
          />
          <ArchiveCycleModal
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            cycleId={cycleId}
            isOpen={archiveCycleModal}
            handleClose={() => setArchiveCycleModal(false)}
          />
          <CycleDeleteModal
            cycle={cycleDetails}
            isOpen={deleteModal}
            handleClose={() => setDeleteModal(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
          />
          <CycleCompleteModal
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            cycleId={cycleId}
            cycleName={cycleDetails.name}
            open={completeModal}
            onClose={() => setCompleteModal(false)}
          />
          <CycleExportModal
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            cycleId={cycleId}
            cycleName={cycleDetails.name}
            open={exportModal}
            onClose={() => setExportModal(false)}
          />
          {additionalModals}
        </div>
      )}
      <ContextMenu parentRef={parentRef} items={renderedItems} />
      {/* propel: the trigger takes no className — the caller's box classes ride on the wrapper */}
      <span className={customClassName}>
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                variant="tertiary"
                size="md"
                icon={<Icon icon={MoreHorizontalOutline} />}
                aria-label={t("common.options")}
                // the legacy menu root swallowed clicks so list rows / links around it never navigated
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
              />
            }
          />
          <MenuContent side="bottom" align="end">
            {renderedItems.map((item, index) => (
              <Fragment key={item.key}>
                {hasMenuSeparatorBefore(renderedItems, index) && <MenuSeparator />}
                <MenuItem
                  variant={resolveItemVariant(item)}
                  icon={item.icon ? <Icon icon={item.icon} /> : undefined}
                  label={item.title ?? ""}
                  description={item.description}
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.action();
                  }}
                />
              </Fragment>
            ))}
          </MenuContent>
        </Menu>
      </span>
    </>
  );
});
