import { Fragment } from "react";
import { Icon } from "@makeplane/propel/components/icon";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { ActionSubmenuContent } from "@plane/blocks/common";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import {
  getDisabledReason,
  getRenderableItems,
  hasMenuSeparatorBefore,
  resolveItemVariant,
  SubmenuSearchList,
} from "@plane/blocks/context-menu";
import { stopQuickActionPropagation } from "./helper";

/** Keep list, board and detail quick actions consistent with their right-click counterparts. */
export function IssueQuickActionMenuItems({ items }: { items: TContextMenuItem[] }) {
  const visibleItems = getRenderableItems(items);
  return visibleItems.map((item, index) => {
    const nestedItems = getRenderableItems(item.nestedMenuItems);
    const icon = item.customContent ?? (item.icon ? <Icon icon={item.icon} /> : undefined);
    // like the right-click menu, a disabled row stays one line with its reason in a tooltip
    const disabledReason = getDisabledReason(item);
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
              {item.searchable ? (
                <SubmenuSearchList
                  item={item}
                  items={nestedItems}
                  renderItems={(matches) => <IssueQuickActionMenuItems items={matches} />}
                />
              ) : (
                <IssueQuickActionMenuItems items={nestedItems} />
              )}
            </ActionSubmenuContent>
          </MenuSubmenu>
        ) : item.checked !== undefined ? (
          <MenuCheckboxItem
            icon={icon}
            label={item.title ?? ""}
            checked={item.checked}
            disabled={item.disabled}
            onCheckedChange={() => item.action()}
          />
        ) : disabledReason ? (
          <Tooltip label={disabledReason} side="right" layout="stacked">
            {/* the disabled row sets `pointer-events: none`, so the wrapper takes the hover */}
            <span className="block">
              <MenuItem
                variant={resolveItemVariant(item)}
                icon={icon}
                label={item.title ?? ""}
                disabled
                onClick={() => item.action()}
              />
            </span>
          </Tooltip>
        ) : (
          <MenuItem
            variant={resolveItemVariant(item)}
            icon={icon}
            label={item.title ?? ""}
            description={item.description}
            selected={item.selected}
            disabled={item.disabled}
            closeOnClick={item.closeOnClick !== false}
            onClick={() => item.action()}
          />
        )}
      </Fragment>
    );
  });
}
