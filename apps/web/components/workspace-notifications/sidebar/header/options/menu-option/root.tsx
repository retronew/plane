/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SlidersHorizontal } from "lucide-react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// plane imports
import type { TNotificationFilter } from "@plane/types";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuTrigger,
  MenuSeparator,
  MenuLabel,
  MenuGroup,
  MenuRadioGroup,
  MenuRadioItem,
} from "@makeplane/propel/components/menu";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";

type TNotificationMenuOption = {
  key: string;
  label: string;
  checked: boolean;
  onChange: () => void;
};

export const NotificationHeaderMenuOption = observer(function NotificationHeaderMenuOption() {
  // hooks
  const { filters, updateFilters, updateBulkFilters } = useWorkspaceNotifications();
  const { t } = useTranslation();

  const handleFilterChange = (filterType: keyof TNotificationFilter, filterValue: boolean) =>
    updateFilters(filterType, filterValue);

  const handleBulkFilterChange = (filter: Partial<TNotificationFilter>) => updateBulkFilters(filter);

  const menuOptions: TNotificationMenuOption[] = [
    {
      key: "menu-unread",
      label: t("notification.options.show_unread"),
      checked: !!filters?.read,
      onChange: () => handleFilterChange("read", !filters?.read),
    },
    {
      key: "menu-snoozed",
      label: t("notification.options.show_snoozed"),
      checked: !!filters?.snoozed,
      onChange: () =>
        handleBulkFilterChange({
          snoozed: !filters?.snoozed,
          archived: false,
        }),
    },
    {
      key: "menu-archived",
      label: t("notification.options.show_archived"),
      checked: !!filters?.archived,
      onChange: () =>
        handleBulkFilterChange({
          archived: !filters?.archived,
          snoozed: false,
        }),
    },
  ];

  return (
    // Toggle rows: checkbox items keep the menu open, as the legacy popover did.
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            size="sm"
            variant="secondary"
            icon={<SlidersHorizontal className="size-3.5" />}
            aria-label={t("web.inbox_filters.sort")}
          />
        }
      />
      <MenuContent side="bottom" align="end">
        {menuOptions.map((option) => (
          <MenuCheckboxItem
            key={option.key}
            label={option.label}
            checked={option.checked}
            onCheckedChange={option.onChange}
          />
        ))}
        <MenuSeparator />
        <MenuGroup>
          <MenuLabel>{t("web.inbox_filters.sort")}</MenuLabel>
          <MenuRadioGroup
            value={filters.order_by ?? "-created_at"}
            onValueChange={(value) => updateFilters("order_by", value as TNotificationFilter["order_by"])}
          >
            {(
              [
                ["-created_at", "web.inbox_filters.newest"],
                ["created_at", "web.inbox_filters.oldest"],
                ["priority", "priority"],
                ["unread", "web.inbox_filters.unread_first"],
              ] as const
            ).map(([value, label]) => (
              <MenuRadioItem key={value} value={value} label={t(label)} />
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
});
