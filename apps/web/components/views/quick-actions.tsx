import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
import { ExportOutline, LockedOutline, MoreHorizontalOutline, UnlockedOutline } from "@makeplane/propel/icons";
import { useProjectView } from "@/hooks/store/use-project-view";
// types
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type { IProjectView } from "@plane/types";
// ui
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import {
  ContextMenu,
  getRenderableItems,
  hasMenuSeparatorBefore,
  resolveItemVariant,
} from "@plane/blocks/context-menu";
import { copyUrlToClipboard } from "@plane/utils";
// helpers
import { useViewMenuItems } from "@/components/common/quick-actions-helper";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { ScopedWorkItemExportModal } from "@/components/cycles/export-modal";
// local imports
import { DeleteProjectViewModal } from "./delete-view-modal";
import { CreateUpdateProjectViewModal } from "./modal";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  projectId: string;
  view: IProjectView;
  workspaceSlug: string;
  /**
   * @deprecated Accepted and ignored. The trigger is a Propel `IconButton`, which takes no
   * `className`, and the legacy dropdown already dropped this class whenever a custom trigger was
   * passed.
   */
  customClassName?: string;
};

export const ViewQuickActions = observer(function ViewQuickActions(props: Props) {
  const { parentRef, projectId, view, workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // states
  const [createUpdateViewModal, setCreateUpdateViewModal] = useState(false);
  const [deleteViewModal, setDeleteViewModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [lockPending, setLockPending] = useState(false);
  const { setViewLock } = useProjectView();
  const handleToggleLock = async () => {
    if (lockPending) return;
    setLockPending(true);
    try {
      await setViewLock(workspaceSlug, projectId, view.id, !view.is_locked);
    } catch (error) {
      console.error("Failed to update view lock", error);
      setToast({ type: "error", title: t("error") });
    } finally {
      setLockPending(false);
    }
  };
  // store hooks
  const { data } = useUser();
  const { allowPermissions } = useUserPermissions();
  // auth
  const isOwner = view?.owned_by === data?.id;
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const viewLink = `${workspaceSlug}/projects/${projectId}/views/${view.id}`;
  const handleCopyText = () =>
    // oxlint-disable-next-line promise/always-return
    copyUrlToClipboard(viewLink).then(() => {
      setToast({
        type: "success",
        title: t("web.link_copied"),
        message: t("web.view_link_copied_to_clipboard"),
      });
    });
  const handleOpenInNewTab = () => window.open(`/${viewLink}`, "_blank", "noopener");

  const menuResult = useViewMenuItems({
    isOwner,
    isAdmin,
    workspaceSlug,
    projectId,
    view,
    handleEdit: () => setCreateUpdateViewModal(true),
    handleDelete: () => setDeleteViewModal(true),
    handleCopyLink: handleCopyText,
    handleOpenInNewTab,
  });

  // Handle both CE (array) and EE (object) return types
  const baseItems = Array.isArray(menuResult) ? menuResult : menuResult.items;
  const MENU_ITEMS: TContextMenuItem[] = getRenderableItems([
    ...baseItems.filter((item) => !["open-new-tab", "open-in-new-tab", "delete"].includes(item.key)),
    {
      key: "export",
      title: t("export"),
      icon: ExportOutline,
      action: () => setExportModal(true),
      shouldRender:
        allowPermissions(
          [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
          EUserPermissionsLevel.PROJECT,
          workspaceSlug,
          projectId
        ) &&
        allowPermissions(
          [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
          EUserPermissionsLevel.WORKSPACE,
          workspaceSlug
        ),
    },
    {
      key: "lock",
      title: view.is_locked ? t("web.unlock") : t("web.lock"),
      icon: view.is_locked ? UnlockedOutline : LockedOutline,
      action: () => void handleToggleLock(),
      shouldRender: isOwner || isAdmin,
      disabled: lockPending,
    },
    ...baseItems.filter((item) => item.key === "delete"),
  ]).map((item) =>
    Object.assign({}, item, {
      section: item.key === "delete" ? "danger" : item.key === "lock" ? "lock" : "actions",
      variant: item.key === "delete" ? ("danger" as const) : ("neutral" as const),
    })
  );
  const additionalModals = Array.isArray(menuResult) ? null : menuResult.modals;

  const CONTEXT_MENU_ITEMS = MENU_ITEMS.map(function CONTEXT_MENU_ITEMS(item) {
    return {
      ...item,
      action: () => {
        item.action();
      },
    };
  });

  return (
    <>
      <CreateUpdateProjectViewModal
        isOpen={createUpdateViewModal}
        onClose={() => setCreateUpdateViewModal(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        data={view}
      />
      <DeleteProjectViewModal data={view} isOpen={deleteViewModal} onClose={() => setDeleteViewModal(false)} />
      <ScopedWorkItemExportModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        entityType="view"
        entityId={view.id}
        entityName={view.name}
        richFilters={view.rich_filters}
        open={exportModal}
        onClose={() => setExportModal(false)}
      />
      {additionalModals}
      <ContextMenu parentRef={parentRef} items={CONTEXT_MENU_ITEMS} />
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              variant="ghost"
              size="md"
              icon={<Icon icon={MoreHorizontalOutline} />}
              aria-label={t("aria_labels.common.more_actions")}
            />
          }
        />
        <MenuContent side="bottom" align="end">
          {MENU_ITEMS.map((item, index) => (
            <Fragment key={item.key}>
              {hasMenuSeparatorBefore(MENU_ITEMS, index) && <MenuSeparator />}
              <MenuItem
                key={item.key}
                variant={resolveItemVariant(item)}
                icon={item.icon ? <Icon icon={item.icon} /> : undefined}
                label={item.title ?? ""}
                description={item.description}
                disabled={item.disabled}
                onClick={() => {
                  item.action();
                }}
              />
            </Fragment>
          ))}
        </MenuContent>
      </Menu>
    </>
  );
});
