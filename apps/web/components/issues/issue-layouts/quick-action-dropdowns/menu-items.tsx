import { Fragment } from "react";
import { Icon } from "@makeplane/propel/components/icon";
import { MenuItem, MenuSeparator, MenuSubmenu, MenuSubmenuTrigger } from "@makeplane/propel/components/menu";
import { ActionSubmenuContent } from "@plane/blocks/common";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { getRenderableItems, hasMenuSeparatorBefore, resolveItemVariant } from "@plane/blocks/context-menu";
import { stopQuickActionPropagation } from "./helper";

/** Keep list, board and detail quick actions consistent with their right-click counterparts. */
export function IssueQuickActionMenuItems({ items }: { items: TContextMenuItem[] }) {
  const visibleItems = getRenderableItems(items);
  return visibleItems.map((item, index) => {
    const nestedItems = getRenderableItems(item.nestedMenuItems);
    const icon = item.icon ? <Icon icon={item.icon} /> : undefined;
    return (
      <Fragment key={item.key}>
        {hasMenuSeparatorBefore(visibleItems, index) && <MenuSeparator />}
        {nestedItems.length ? (
          <MenuSubmenu>
            <MenuSubmenuTrigger
              variant={resolveItemVariant(item)}
              icon={icon}
              label={item.title ?? ""}
              disabled={item.disabled}
            />
            <ActionSubmenuContent onClick={stopQuickActionPropagation}>
              <IssueQuickActionMenuItems items={nestedItems} />
            </ActionSubmenuContent>
          </MenuSubmenu>
        ) : (
          <MenuItem
            variant={resolveItemVariant(item)}
            icon={icon}
            label={item.title ?? ""}
            description={item.description}
            disabled={item.disabled}
            closeOnClick={item.closeOnClick !== false}
            onClick={() => item.action()}
          />
        )}
      </Fragment>
    );
  });
}
