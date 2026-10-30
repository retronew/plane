/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useCallback } from "react";
import {
  ArchiveOutline,
  CloseCircleOutline,
  CopyOutline,
  DeleteOutline,
  EditOutline,
  LinkOutline,
  NewTabOutline,
  RestoreOutline,
} from "@makeplane/propel/icons";
// plane imports
import { useTranslation, translate } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { EIssuesStoreType, TIssue } from "@plane/types";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { copyTextToClipboard, copyUrlToClipboard, generateWorkItemLink } from "@plane/utils";
import { createCopyMenuWithDuplication } from "./copy-menu-helper";
import { usePropertyMenuItems } from "./property-menu-items";

/**
 * The quick-action menus sit inside clickable rows (ControlLink anchors, row `onClick`s). The legacy
 * menu's root swallowed clicks for them; Propel's `Menu` renders no element, so the trigger carries
 * the guard (click + Enter/Space) and the portalled popup stops item clicks from bubbling up the React
 * tree to the row. Base UI still runs its own trigger handler, so the menu opens as before.
 */
export const quickActionTriggerGuard = {
  onClick: (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  },
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
  },
};

/**
 * `MenuTrigger` defaults to `nativeButton`, so a caller's `customActionButton` that isn't a real
 * `<button>` (e.g. a `<div>`) would get no role/tabIndex and trip Base UI's native-button check.
 * Returns the `nativeButton` flag for the rendered trigger: true for the IconButton fallback and
 * `<button>` elements, false otherwise so Base UI adds `role="button"` + `tabIndex` + key handling.
 */
export const isNativeQuickActionTrigger = (customActionButton: React.ReactElement | undefined) =>
  !customActionButton || customActionButton.type === "button";

export const stopQuickActionPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

// Generic helper function to handle optional function calls gracefully
// Overload for functions without parameters
export function handleOptionalAction(
  optionalFn: (() => void) | (() => Promise<void>) | undefined,
  actionName: string
): void;

// Overload for functions with one parameter
export function handleOptionalAction<T>(
  optionalFn: ((param: T) => void) | ((param: T) => Promise<void>) | undefined,
  actionName: string,
  param: T
): void;

// Implementation
export function handleOptionalAction<T>(
  optionalFn: (() => void) | (() => Promise<void>) | ((param: T) => void) | ((param: T) => Promise<void>) | undefined,
  actionName: string,
  param?: T
): void {
  if (optionalFn) {
    if (param !== undefined) {
      (optionalFn as (param: T) => void | Promise<void>)(param);
    } else {
      (optionalFn as () => void | Promise<void>)();
    }
  } else {
    setToast({
      type: "error",
      title: translate("web.action_not_available"),
      message: translate("web.runtime.action_unavailable", { action: actionName }),
    });
  }
}

export interface MenuItemFactoryProps {
  issue: TIssue;
  workspaceSlug?: string;
  projectIdentifier?: string;
  activeLayout?: string;
  isEditingAllowed: boolean;
  isArchivingAllowed?: boolean;
  isDeletingAllowed: boolean;
  isRestoringAllowed?: boolean;
  isInArchivableGroup?: boolean;
  issueTypeDetail?: { is_active?: boolean };
  // Action handlers
  setIssueToEdit: (issue: TIssue | undefined) => void;
  setCreateUpdateIssueModal: (open: boolean) => void;
  setDeleteIssueModal: (open: boolean) => void;
  setArchiveIssueModal?: (open: boolean) => void;
  setDuplicateWorkItemModal?: (open: boolean) => void;
  handleRemoveFromView?: () => void;
  handleRestore?: () => Promise<void>;
  // External handlers
  handleDelete?: () => Promise<void>;
  handleUpdate?: (data: TIssue) => Promise<void>;
  handleArchive?: () => Promise<void>;
  /** "Create related" and subscription rows from `useRelatedMenuItems`; the caller renders their modals. */
  relatedMenuItems?: TContextMenuItem[];
  // Context-specific data
  cycleId?: string;
  moduleId?: string;
  storeType?: EIssuesStoreType;
}

const copyWithToast = (text: string, successKey: string, errorKey: string) =>
  copyTextToClipboard(text)
    .then(() => setToast({ type: "success", title: translate(successKey) }))
    .catch(() => setToast({ type: "error", title: translate(errorKey) }));

// Common action handlers hook
export const useIssueActionHandlers = (props: MenuItemFactoryProps) => {
  const { issue, workspaceSlug, projectIdentifier, handleRestore } = props;

  const workItemLink = useMemo(
    () =>
      generateWorkItemLink({
        workspaceSlug,
        projectId: issue?.project_id,
        issueId: issue?.id,
        projectIdentifier,
        sequenceId: issue?.sequence_id,
      }),
    [workspaceSlug, projectIdentifier, issue]
  );

  const handleCopyIssueLink = () =>
    copyUrlToClipboard(workItemLink).then(() =>
      setToast({
        type: "success",
        title: translate("web.link_copied_acf8"),
        message: translate("web.work_item_link_copied_to_clipboard"),
      })
    );

  const handleCopyIssueId = () =>
    copyWithToast(
      `${projectIdentifier}-${issue?.sequence_id}`,
      "power_k.contextual_actions.work_item.copy_id_toast_success",
      "power_k.contextual_actions.work_item.copy_id_toast_error"
    );

  const handleCopyIssueTitle = () =>
    copyWithToast(
      issue?.name ?? "",
      "power_k.contextual_actions.work_item.copy_title_toast_success",
      "power_k.contextual_actions.work_item.copy_title_toast_error"
    );

  const handleOpenInNewTab = () => window.open(workItemLink, "_blank", "noopener");

  const handleIssueRestore = async () => {
    if (!handleRestore) {
      handleOptionalAction(handleRestore, translate("web.runtime.action_restore"));
      return;
    }
    await handleRestore()
      // oxlint-disable-next-line promise/always-return
      .then(() => {
        setToast({
          type: "success",
          title: translate("web.restore_success"),
          message: translate("web.your_work_item_can_be_found_in_project_work_items"),
        });
      })
      .catch(() => {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.work_item_could_not_be_restored_please_try_again"),
        });
      });
  };

  return {
    workItemLink,
    handleCopyIssueLink,
    handleCopyIssueId,
    handleCopyIssueTitle,
    handleOpenInNewTab,
    handleIssueRestore,
  };
};

export const useMenuItemFactory = (props: MenuItemFactoryProps) => {
  const { t } = useTranslation();
  const actionHandlers = useIssueActionHandlers(props);
  // the board/list handlers forward this straight to `updateIssue`, which takes a partial payload
  const { handleUpdate } = props;
  const propertyMenuItems = usePropertyMenuItems({
    issue: props.issue,
    isEditingAllowed: props.isEditingAllowed,
    onUpdate: handleUpdate ? (data) => handleUpdate(data as TIssue) : undefined,
  });

  const {
    issue,
    activeLayout = "",
    isEditingAllowed,
    isArchivingAllowed = false,
    isDeletingAllowed,
    isRestoringAllowed = false,
    isInArchivableGroup = false,
    issueTypeDetail,
    setIssueToEdit,
    setCreateUpdateIssueModal,
    setDeleteIssueModal,
    setArchiveIssueModal,
    setDuplicateWorkItemModal,
    handleRemoveFromView,
  } = props;

  const createEditMenuItem = (customEditAction?: () => void): TContextMenuItem => ({
    key: "edit",
    section: "edit",
    title: t("common.actions.edit"),
    icon: EditOutline,
    action:
      customEditAction ||
      (() => {
        setIssueToEdit(issue);
        setCreateUpdateIssueModal(true);
      }),
    shouldRender: isEditingAllowed,
  });

  const createCopyMenuItem = (workspaceSlug?: string): TContextMenuItem => {
    const baseItem = {
      key: "make-a-copy",
      section: "share",
      title: t("common.actions.make_a_copy"),
      icon: CopyOutline,
      action: () => {
        setCreateUpdateIssueModal(true);
      },
      shouldRender: isEditingAllowed && (issueTypeDetail?.is_active ?? true),
    };

    return createCopyMenuWithDuplication({
      baseItem,
      activeLayout,
      setCreateUpdateIssueModal,
      setDuplicateWorkItemModal,
      workspaceSlug,
    });
  };

  const createOpenInNewTabMenuItem = (): TContextMenuItem => ({
    key: "open-in-new-tab",
    section: "share",
    title: t("common.actions.open_in_new_tab"),
    icon: NewTabOutline,
    action: actionHandlers.handleOpenInNewTab,
  });

  const createCopyLinkMenuItem = (): TContextMenuItem => ({
    key: "copy-link",
    section: "share",
    title: t("common.actions.copy_link"),
    icon: LinkOutline,
    action: actionHandlers.handleCopyIssueLink,
  });

  /** Linear's "Copy" submenu: link, ID and title of the work item. */
  const createCopySubmenuItem = (): TContextMenuItem => ({
    key: "copy",
    section: "share",
    title: t("common.actions.copy"),
    icon: CopyOutline,
    action: () => {},
    nestedMenuItems: [
      createCopyLinkMenuItem(),
      {
        key: "copy-id",
        title: t("power_k.contextual_actions.work_item.copy_id"),
        action: actionHandlers.handleCopyIssueId,
        shouldRender: !!props.projectIdentifier && issue?.sequence_id !== undefined,
      },
      {
        key: "copy-title",
        title: t("power_k.contextual_actions.work_item.copy_title"),
        action: actionHandlers.handleCopyIssueTitle,
      },
    ],
  });

  const createRemoveFromCycleMenuItem = (): TContextMenuItem => ({
    key: "remove-from-cycle",
    section: "membership",
    title: t("web.remove_from_cycle"),
    icon: CloseCircleOutline,
    action: () => handleOptionalAction(handleRemoveFromView, translate("web.runtime.action_remove_from_cycle")),
    shouldRender: isEditingAllowed,
  });

  const createRemoveFromModuleMenuItem = (): TContextMenuItem => ({
    key: "remove-from-module",
    section: "membership",
    title: t("web.remove_from_module"),
    icon: CloseCircleOutline,
    action: () => handleOptionalAction(handleRemoveFromView, translate("web.runtime.action_remove_from_module")),
    shouldRender: isEditingAllowed,
  });

  const createArchiveMenuItem = (): TContextMenuItem => ({
    key: "archive",
    section: "lifecycle",
    title: t("common.actions.archive"),
    description: isInArchivableGroup ? undefined : t("issue.archive.description"),
    icon: ArchiveOutline,
    action: () => handleOptionalAction(setArchiveIssueModal, translate("web.runtime.action_archive"), true),
    disabled: !isInArchivableGroup,
    shouldRender: isArchivingAllowed,
  });

  const createRestoreMenuItem = (): TContextMenuItem => ({
    key: "restore",
    section: "lifecycle",
    title: t("web.restore"),
    icon: RestoreOutline,
    action: actionHandlers.handleIssueRestore,
    shouldRender: isRestoringAllowed,
  });

  const createDeleteMenuItem = (): TContextMenuItem => ({
    key: "delete",
    section: "danger",
    variant: "danger",
    title: t("common.actions.delete"),
    icon: DeleteOutline,
    action: () => {
      setDeleteIssueModal(true);
    },
    shouldRender: isDeletingAllowed,
  });

  return {
    ...actionHandlers,
    propertyMenuItems,
    relatedMenuItems: (props.relatedMenuItems ?? []).filter((item) => item.section !== "notify"),
    // Linear keeps subscribe/unsubscribe in its own group near the bottom, above the lifecycle rows
    subscriptionMenuItems: (props.relatedMenuItems ?? []).filter((item) => item.section === "notify"),
    createEditMenuItem,
    createCopyMenuItem,
    createOpenInNewTabMenuItem,
    createCopyLinkMenuItem,
    createCopySubmenuItem,
    createRemoveFromCycleMenuItem,
    createRemoveFromModuleMenuItem,
    createArchiveMenuItem,
    createRestoreMenuItem,
    createDeleteMenuItem,
  };
};

// Predefined menu item sets for different contexts
export const useProjectIssueMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);

  return useMemo(
    () => [
      ...factory.propertyMenuItems,
      factory.createEditMenuItem(),
      ...factory.relatedMenuItems,
      factory.createOpenInNewTabMenuItem(),
      factory.createCopySubmenuItem(),
      factory.createCopyMenuItem(),
      ...factory.subscriptionMenuItems,
      factory.createArchiveMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    [factory]
  );
};

export const useWorkItemDetailMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);

  return useMemo(
    () => [
      factory.createCopyMenuItem(props.workspaceSlug),
      factory.createOpenInNewTabMenuItem(),
      factory.createArchiveMenuItem(),
      factory.createRestoreMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [factory, props.workspaceSlug]
  );
};

export const useAllIssueMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);

  return useMemo(
    () => [
      ...factory.propertyMenuItems,
      factory.createEditMenuItem(),
      ...factory.relatedMenuItems,
      factory.createOpenInNewTabMenuItem(),
      factory.createCopySubmenuItem(),
      factory.createCopyMenuItem(),
      ...factory.subscriptionMenuItems,
      factory.createArchiveMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    [factory]
  );
};

export const useCycleIssueMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);
  const { issue, cycleId, setIssueToEdit, setCreateUpdateIssueModal } = props;

  const customEditAction = useCallback(() => {
    setIssueToEdit({
      ...issue,
      cycle_id: cycleId ?? null,
    });
    setCreateUpdateIssueModal(true);
  }, [issue, cycleId, setIssueToEdit, setCreateUpdateIssueModal]);

  return useMemo(
    () => [
      ...factory.propertyMenuItems,
      factory.createEditMenuItem(customEditAction),
      ...factory.relatedMenuItems,
      factory.createOpenInNewTabMenuItem(),
      factory.createCopySubmenuItem(),
      factory.createCopyMenuItem(),
      factory.createRemoveFromCycleMenuItem(),
      ...factory.subscriptionMenuItems,
      factory.createArchiveMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [factory, customEditAction]
  );
};

export const useModuleIssueMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);
  const { issue, moduleId, setIssueToEdit, setCreateUpdateIssueModal } = props;

  const customEditAction = useCallback(() => {
    setIssueToEdit({
      ...issue,
      module_ids: moduleId ? [moduleId] : [],
    });
    setCreateUpdateIssueModal(true);
  }, [issue, moduleId, setIssueToEdit, setCreateUpdateIssueModal]);

  return useMemo(
    () => [
      ...factory.propertyMenuItems,
      factory.createEditMenuItem(customEditAction),
      ...factory.relatedMenuItems,
      factory.createOpenInNewTabMenuItem(),
      factory.createCopySubmenuItem(),
      factory.createCopyMenuItem(),
      factory.createRemoveFromModuleMenuItem(),
      ...factory.subscriptionMenuItems,
      factory.createArchiveMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [factory, customEditAction]
  );
};

export const useArchivedIssueMenuItems = (props: MenuItemFactoryProps): TContextMenuItem[] => {
  const factory = useMenuItemFactory(props);

  return useMemo(
    () => [
      factory.createRestoreMenuItem(),
      factory.createOpenInNewTabMenuItem(),
      factory.createCopyLinkMenuItem(),
      factory.createDeleteMenuItem(),
    ],
    [factory]
  );
};
