import { useMemo } from "react";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import type { TPopoverMenuPlacement } from "@plane/blocks/common";
import { ActionMenuContent as MenuContent, toSideAndAlign } from "@plane/blocks/common";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu } from "@plane/blocks/context-menu";
import { useTranslation } from "@plane/i18n";
// local imports
import { isNativeQuickActionTrigger, quickActionTriggerGuard, stopQuickActionPropagation } from "./helper";
import { IssueQuickActionMenuItems } from "./menu-items";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  /** Rows of the overflow menu, already built for this context. */
  menuItems: TContextMenuItem[];
  placements: TPopoverMenuPlacement;
  customActionButton?: React.ReactElement;
};

/**
 * The right-click context menu and its overflow trigger, shared by every quick-action dropdown. The
 * legacy context menu takes the same rows with a click handler, so both stay in sync from one list.
 */
export function IssueQuickActionMenu({ parentRef, menuItems, placements, customActionButton }: Props) {
  const { t } = useTranslation();
  // rows that load their state lazily (e.g. the subscription) fetch it whenever either menu opens
  const handleOpenChange = (open: boolean) => {
    if (open) menuItems.forEach((item) => item.onMenuOpen?.());
  };
  const contextMenuItems = useMemo(
    () => menuItems.map((item) => ({ ...item, onClick: () => item.action() })),
    [menuItems]
  );

  return (
    <>
      <ContextMenu parentRef={parentRef} items={contextMenuItems} onOpenChange={handleOpenChange} />
      <Menu onOpenChange={handleOpenChange}>
        <MenuTrigger
          {...quickActionTriggerGuard}
          nativeButton={isNativeQuickActionTrigger(customActionButton)}
          aria-label={t("aria_labels.common.more_actions")}
          render={
            customActionButton ?? (
              // Icon-only fallback trigger, so it needs an explicit accessible name.
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t("aria_labels.common.more_actions")}
                icon={<Icon icon={MoreHorizontalOutline} />}
              />
            )
          }
        />
        <MenuContent {...toSideAndAlign(placements)} onClick={stopQuickActionPropagation}>
          <IssueQuickActionMenuItems items={menuItems} />
        </MenuContent>
      </Menu>
    </>
  );
}
