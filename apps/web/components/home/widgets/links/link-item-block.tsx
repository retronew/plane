/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createElement, Fragment } from "react";
// plane imports
import { Icon as PropelIcon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreVerticalOutline } from "@makeplane/propel/icons";
import { getRenderableItems, resolveItemVariant } from "@plane/blocks/context-menu";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { useTranslation } from "@plane/i18n";
import { calculateTimeAgo, getIconForLink } from "@plane/utils";

export type TLinkItemBlockProps = {
  title: string;
  url: string;
  createdAt?: Date | string;
  menuItems?: TContextMenuItem[];
  onClick?: () => void;
};

export function LinkItemBlock(props: TLinkItemBlockProps) {
  // props
  const { title, url, createdAt, menuItems, onClick } = props;
  // plane hooks
  const { t } = useTranslation();
  // icons
  const Icon = getIconForLink(url);
  const items = getRenderableItems(menuItems);
  return (
    <div className="group flex h-[51px] min-w-0 items-center gap-4 rounded-lg border-[0.5px] border-subtle-1 bg-layer-2 p-2">
      {/* the card body is its own button so the menu trigger is not nested inside a clickable ancestor */}
      <button
        type="button"
        onClick={onClick}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-layer-1 p-2">
          {createElement(Icon, { className: "size-4 text-tertiary group-hover:text-primary" })}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-xs-regular text-primary">{title}</span>
          {createdAt && (
            <span className="truncate text-caption-md-regular text-tertiary">{calculateTimeAgo(createdAt)}</span>
          )}
        </span>
      </button>
      {items.length > 0 && (
        <div className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-popup-open]]:opacity-100">
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={t("aria_labels.common.more_actions")}
                  icon={<PropelIcon icon={MoreVerticalOutline} />}
                />
              }
            />
            <MenuContent side="bottom" align="end">
              {items.map((item, index) => (
                <Fragment key={item.key}>
                  {resolveItemVariant(item) === "danger" && index > 0 && <MenuSeparator />}
                  <MenuItem
                    render={<div className="h-8! py-0!" />}
                    variant={resolveItemVariant(item)}
                    icon={item.icon ? <PropelIcon icon={item.icon} /> : undefined}
                    label={item.title ?? ""}
                    description={item.description}
                    disabled={item.disabled}
                    onClick={() => item.action()}
                  />
                </Fragment>
              ))}
            </MenuContent>
          </Menu>
        </div>
      )}
    </div>
  );
}
