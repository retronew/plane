import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
import { ExportOutline, ShowOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
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
import { generateQueryParams, copyUrlToClipboard } from "@plane/utils";
// components
import { useModuleMenuItems } from "@/components/common/quick-actions-helper";
import { ArchiveModuleModal, CreateUpdateModuleModal, DeleteModuleModal } from "@/components/modules";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

import { usePathname, useSearchParams } from "next/navigation";
import { ScopedWorkItemExportModal } from "@/components/cycles/export-modal";

type Props = {
  parentRef: React.RefObject<HTMLDivElement | null>;
  moduleId: string;
  projectId: string;
  workspaceSlug: string;
  customClassName?: string;
};

export const ModuleQuickActions = observer(function ModuleQuickActions(props: Props) {
  const { parentRef, moduleId, projectId, workspaceSlug, customClassName } = props;
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // plane hooks
  const { t } = useTranslation();
  // states
  const [exportModal, setExportModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [archiveModuleModal, setArchiveModuleModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  // store hooks
  const { allowPermissions } = useUserPermissions();

  const { getModuleById, restoreModule } = useModule();

  // derived values
  const moduleDetails = getModuleById(moduleId);
  // auth
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const moduleLink = `${workspaceSlug}/projects/${projectId}/modules/${moduleId}`;
  const handleCopyText = () =>
    copyUrlToClipboard(moduleLink).then(() => {
      setToast({
        type: "success",
        title: t("web.link_copied"),
        message: t("web.module_link_copied_to_clipboard"),
      });
      return undefined;
    });
  const handleOpenInNewTab = () => window.open(`/${moduleLink}`, "_blank", "noopener");

  const handleRestoreModule = async () => {
    try {
      await restoreModule(workspaceSlug, projectId, moduleId);
      setToast({
        type: "success",
        title: t("web.restore_success"),
        message: t("web.your_module_can_be_found_in_project_modules"),
      });
      router.push(`/${workspaceSlug}/projects/${projectId}/archives/modules`);
    } catch (_error) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.module_could_not_be_restored_please_try_again"),
      });
    }
  };

  // Use unified menu hook from plane-web (resolves to CE or EE)
  const menuResult = useModuleMenuItems({
    moduleDetails: moduleDetails ?? undefined,
    workspaceSlug,
    projectId,
    moduleId,
    isEditingAllowed,
    handleEdit: () => setEditModal(true),
    handleArchive: () => setArchiveModuleModal(true),
    handleRestore: handleRestoreModule,
    handleDelete: () => setDeleteModal(true),
    handleCopyLink: handleCopyText,
    handleOpenInNewTab,
  });

  // Handle both CE (array) and EE (object) return types
  const baseItems = Array.isArray(menuResult) ? menuResult : menuResult.items;
  const MENU_ITEMS: TContextMenuItem[] = getRenderableItems([
    ...baseItems.filter((item) => item.key === "edit"),
    {
      key: "details",
      title: t("common.overview"),
      icon: ShowOutline,
      action: () => {
        const listPath = `/${workspaceSlug}/projects/${projectId}/${moduleDetails?.archived_at ? "archives/modules" : "modules"}`;
        const isListPath = pathname.replace(/\/$/, "") === listPath;
        const query = isListPath ? generateQueryParams(searchParams, ["peekModule"]) : "";
        router.push(`${isListPath ? pathname : listPath}?${query ? `${query}&` : ""}peekModule=${moduleId}`);
      },
    },
    ...baseItems.filter((item) => !["edit", "archive", "restore", "delete"].includes(item.key)),
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
    ...baseItems.filter((item) => ["archive", "restore", "delete"].includes(item.key)),
  ]).map((item) =>
    Object.assign({}, item, {
      section: ["archive", "restore", "delete"].includes(item.key) ? "lifecycle" : "actions",
      variant: item.key === "delete" ? ("danger" as const) : ("neutral" as const),
    })
  );
  const additionalModals = Array.isArray(menuResult) ? null : menuResult.modals;

  const CONTEXT_MENU_ITEMS = MENU_ITEMS.map(function CONTEXT_MENU_ITEMS(item) {
    return {
      ...item,

      onClick: () => {
        item.action();
      },
    };
  });

  return (
    <>
      {moduleDetails && (
        <div className="fixed">
          <CreateUpdateModuleModal
            isOpen={editModal}
            onClose={() => setEditModal(false)}
            data={moduleDetails}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
          <ArchiveModuleModal
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            moduleId={moduleId}
            isOpen={archiveModuleModal}
            handleClose={() => setArchiveModuleModal(false)}
          />
          <DeleteModuleModal data={moduleDetails} isOpen={deleteModal} onClose={() => setDeleteModal(false)} />
          <ScopedWorkItemExportModal
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            entityType="module"
            entityId={moduleId}
            entityName={moduleDetails.name}
            open={exportModal}
            onClose={() => setExportModal(false)}
          />
          {additionalModals}
        </div>
      )}
      <ContextMenu parentRef={parentRef} items={CONTEXT_MENU_ITEMS} />
      {/* The legacy menu applied `customClassName` to the button around the trigger; a wrapper keeps
          that chrome off the Propel IconButton. */}
      <span className={customClassName}>
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                variant="ghost"
                size="md"
                icon={<Icon icon={MoreHorizontalOutline} />}
                aria-label={t("aria_labels.projects_sidebar.toggle_quick_actions_menu")}
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
                  label={item.title ?? ""}
                  description={item.description}
                  icon={item.icon && <Icon icon={item.icon} />}
                  disabled={item.disabled}
                  onClick={() => {
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
