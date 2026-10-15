/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Fragment } from "react";
import { useTranslation } from "@plane/i18n";
// ui
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu, getRenderableItems, resolveItemVariant } from "@plane/blocks/context-menu";

export interface Props {
  parentRef: React.RefObject<HTMLElement | null>;
  MENU_ITEMS: TContextMenuItem[];
}

export const WorkspaceDraftIssueQuickActions = observer(function WorkspaceDraftIssueQuickActions(props: Props) {
  const { parentRef, MENU_ITEMS } = props;

  const { t } = useTranslation();
  const menuItems = getRenderableItems(MENU_ITEMS).map((item) =>
    Object.assign({}, item, { title: t(item.title || "") })
  );

  return (
    <>
      <ContextMenu parentRef={parentRef} items={menuItems} />
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={t("aria_labels.common.more_actions")}
              icon={<Icon icon={MoreHorizontalOutline} />}
            />
          }
        />
        <MenuContent side="bottom" align="end" sizing="anchor">
          <div className="min-w-28">
            {menuItems.map((item, index) => (
              <Fragment key={item.key}>
                {resolveItemVariant(item) === "danger" && index > 0 && <MenuSeparator />}
                <MenuItem
                  render={<div className="h-8! py-0!" />}
                  variant={resolveItemVariant(item)}
                  icon={item.icon ? <Icon icon={item.icon} /> : undefined}
                  label={item.title}
                  description={item.description}
                  onClick={() => {
                    item.action();
                  }}
                  disabled={item.disabled}
                />
              </Fragment>
            ))}
          </div>
        </MenuContent>
      </Menu>
    </>
  );
});
