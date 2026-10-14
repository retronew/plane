/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import type { ENotificationFilterType } from "@plane/constants";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { selectedNotificationFilterValues, useNotificationFilterGroups } from "./use-filter-groups";

export const AppliedFilters = observer(function AppliedFilters({ workspaceSlug }: { workspaceSlug: string }) {
  const { t } = useTranslation();
  const { filters, updateFilters, updateBulkFilters } = useWorkspaceNotifications();
  const groups = useNotificationFilterGroups();
  if (!workspaceSlug || !groups.some(({ key }) => selectedNotificationFilterValues(filters, key).length)) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-subtle px-5 py-2">
      {groups.flatMap(({ key, label, options }) =>
        selectedNotificationFilterValues(filters, key).map((value) => (
          <button
            key={`${key}-${value}`}
            type="button"
            className="flex max-w-full items-center gap-1 rounded border border-subtle px-1.5 py-0.5 text-11 text-secondary hover:bg-layer-1"
            onClick={() => {
              if (key === "type") updateFilters("type", { ...filters.type, [value as ENotificationFilterType]: false });
              else
                updateFilters(
                  key,
                  (filters[key] ?? []).filter((v) => v !== value)
                );
            }}
          >
            <span className="truncate">
              {label}: {options.find((o) => o.value === value)?.label ?? value}
            </span>
            <X className="size-3 shrink-0" />
          </button>
        ))
      )}
      <button
        type="button"
        className="px-1 text-11 text-tertiary hover:text-primary"
        onClick={() =>
          updateBulkFilters({
            type: { assigned: false, created: false, subscribed: false },
            priority: [],
            state_group: [],
            assignees: [],
            triggered_by: [],
            project: [],
          })
        }
      >
        {t("common.clear_all")}
      </button>
    </div>
  );
});
