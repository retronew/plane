/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { ListFilter } from "lucide-react";
import type { ENotificationFilterType } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuTrigger,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuSubmenuContent,
  MenuLabel,
  MenuGroup,
  MenuSearch,
} from "@makeplane/propel/components/menu";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { selectedNotificationFilterValues, useNotificationFilterGroups } from "../use-filter-groups";

export const NotificationFilter = observer(function NotificationFilter() {
  const { t } = useTranslation();
  const { filters, updateFilters } = useWorkspaceNotifications();
  const groups = useNotificationFilterGroups();
  const [search, setSearch] = useState("");
  const active = groups.some(({ key }) => selectedNotificationFilterValues(filters, key).length > 0);
  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            size="sm"
            variant="secondary"
            icon={<ListFilter className={`size-3.5 ${active ? "text-accent-primary" : ""}`} />}
            aria-label={t("web.inbox_filters.label")}
          />
        }
      />
      <MenuContent side="bottom" align="end">
        <MenuGroup>
          <MenuLabel>{t("web.inbox_filters.label")}</MenuLabel>
          {groups.map(({ key, label, icon: GroupIcon, options, searchable }) => (
            <MenuSubmenu key={key} onOpenChange={() => setSearch("")}>
              <MenuSubmenuTrigger label={label} icon={<GroupIcon className="size-4" />} />
              <MenuSubmenuContent
                search={
                  searchable ? (
                    <MenuSearch value={search} onValueChange={setSearch} placeholder={t("search")} />
                  ) : undefined
                }
              >
                {options
                  .filter((o) => !searchable || o.label.toLowerCase().includes(search.toLowerCase()))
                  .map((option) => {
                    const selected = selectedNotificationFilterValues(filters, key);
                    return (
                      <MenuCheckboxItem
                        key={option.value}
                        label={option.label}
                        checked={selected.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (key === "type")
                            updateFilters("type", {
                              ...filters.type,
                              [option.value as ENotificationFilterType]: checked,
                            });
                          else
                            updateFilters(
                              key,
                              checked ? [...selected, option.value] : selected.filter((v) => v !== option.value)
                            );
                        }}
                      />
                    );
                  })}
                {options.filter((o) => !searchable || o.label.toLowerCase().includes(search.toLowerCase())).length ===
                  0 && <div className="px-2 py-3 text-12 text-tertiary">{t("web.inbox_filters.no_results")}</div>}
              </MenuSubmenuContent>
            </MenuSubmenu>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
});
