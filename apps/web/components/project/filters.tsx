/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";

import { ProjectLayoutSwitch } from "./layout-switch";
import { ProjectDisplayMenu } from "./dropdowns/display";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TProjectFilters } from "@plane/types";
import { cn, calculateTotalFilters } from "@plane/utils";
// components
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
// local imports
import { ProjectFiltersSelection } from "./dropdowns/filters";

type Props = {
  filterMenuButton?: React.ReactNode;
  classname?: string;
  filterClassname?: string;
  isMobile?: boolean;
};

const HeaderFilters = observer(function HeaderFilters({
  filterMenuButton,
  classname = "",
  filterClassname = "",
}: Props) {
  // i18n
  const { t } = useTranslation();
  // router
  const { workspaceSlug } = useParams();
  const {
    currentWorkspaceDisplayFilters: displayFilters,
    currentWorkspaceFilters: filters,
    updateFilters,
    updateDisplayFilters,
  } = useProjectFilter();
  const {
    workspace: { workspaceMemberIds },
  } = useMember();
  const handleFilters = useCallback(
    (key: keyof TProjectFilters, value: string | string[]) => {
      if (!workspaceSlug) return;
      let newValues = [...(filters?.[key] ?? [])];
      if (Array.isArray(value)) {
        if (key === "created_at" && newValues.find((v) => v.includes("custom"))) newValues = [];
        const newValuesSet = new Set(newValues);
        value.forEach((val) => {
          if (!newValuesSet.has(val)) {
            newValues.push(val);
            newValuesSet.add(val);
          } else {
            newValues.splice(newValues.indexOf(val), 1);
            newValuesSet.delete(val);
          }
        });
      } else {
        if (filters?.[key]?.includes(value)) newValues.splice(newValues.indexOf(value), 1);
        else {
          if (key === "created_at") newValues = [value];
          else newValues.push(value);
        }
      }

      updateFilters(workspaceSlug.toString(), { [key]: newValues });
    },
    [filters, updateFilters, workspaceSlug]
  );

  const active = calculateTotalFilters(filters ?? {}) > 0;
  return (
    <div className={cn("flex items-center gap-2", classname)}>
      <ProjectLayoutSwitch />
      <div className={cn(filterClassname)}>
        <Menu>
          <MenuTrigger
            render={
              filterMenuButton ? (
                <button type="button" aria-label={t("common.filters")}>
                  {filterMenuButton}
                </button>
              ) : (
                <FilterToggleButton
                  active={active}
                  size="md"
                  showTooltip
                  aria-pressed={active}
                  aria-label={t("common.filters")}
                />
              )
            }
          />
          <MenuContent side="bottom" align="end">
            <ProjectFiltersSelection
              displayFilters={displayFilters ?? {}}
              filters={filters ?? {}}
              handleFiltersUpdate={handleFilters}
              handleDisplayFiltersUpdate={(val) => {
                if (!workspaceSlug) return;
                updateDisplayFilters(workspaceSlug.toString(), val);
              }}
              memberIds={workspaceMemberIds ?? undefined}
            />
          </MenuContent>
        </Menu>
      </div>
      <ProjectDisplayMenu
        layout={displayFilters?.layout}
        groupBy={displayFilters?.group_by}
        onGroupChange={(group_by) => {
          if (workspaceSlug) updateDisplayFilters(String(workspaceSlug), { group_by });
        }}
        value={displayFilters?.order_by}
        onChange={(order_by) => {
          if (workspaceSlug) updateDisplayFilters(String(workspaceSlug), { order_by });
        }}
      />
    </div>
  );
});
export default HeaderFilters;
