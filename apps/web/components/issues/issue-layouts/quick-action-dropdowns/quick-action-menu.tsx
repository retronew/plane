import { useEffect, useEffectEvent, useState } from "react";
import { observer } from "mobx-react";
import type { MenuItemFactoryProps } from "./helper";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import type { TPopoverMenuPlacement } from "@plane/blocks/common";
import { ActionMenuContent as MenuContent, toSideAndAlign } from "@plane/blocks/common";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu, ContextMenuItems } from "@plane/blocks/context-menu";
import { useTranslation } from "@plane/i18n";
// local imports
import { isNativeQuickActionTrigger, quickActionTriggerGuard, stopQuickActionPropagation } from "./helper";
import { IssueQuickActionMenuItems } from "./menu-items";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  menuItemProps: MenuItemFactoryProps;
  children?: React.ReactNode;
  placements: TPopoverMenuPlacement;
  customActionButton?: React.ReactElement;
};

/**
 * Both triggers stay mounted on the card. Their popup mounts the observer that reads project
 * candidates and builds rows only when that particular menu is opened.
 */
export function createIssueQuickActionMenu(useMenuItems: (props: MenuItemFactoryProps) => TContextMenuItem[]) {
  const Rows = observer(function IssueMenuRows({
    menuItemProps,
    contextMenu,
  }: Pick<Props, "menuItemProps"> & { contextMenu?: boolean }) {
    const items = useMenuItems(menuItemProps);
    const prefetch = useEffectEvent(() => items.forEach((item) => item.onMenuOpen?.()));
    useEffect(() => {
      prefetch();
    }, []);
    return contextMenu ? <ContextMenuItems items={items} /> : <IssueQuickActionMenuItems items={items} />;
  });

  return function IssueQuickActionMenu({ parentRef, menuItemProps, placements, customActionButton, children }: Props) {
    const { t } = useTranslation();
    const [hasOpened, setHasOpened] = useState(false);
    // Dialogs opened by a row must survive the menu closing, including their exit animations.
    const mountDialogs = (open: boolean) => {
      if (open) setHasOpened(true);
    };
    return (
      <>
        {hasOpened && children}
        <ContextMenu parentRef={parentRef} onOpenChange={mountDialogs}>
          <Rows key={menuItemProps.issue.id} menuItemProps={menuItemProps} contextMenu />
        </ContextMenu>
        <Menu onOpenChange={mountDialogs}>
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
            <Rows key={menuItemProps.issue.id} menuItemProps={menuItemProps} />
          </MenuContent>
        </Menu>
      </>
    );
  };
}
