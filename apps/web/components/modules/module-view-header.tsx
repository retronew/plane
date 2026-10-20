/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CardLayoutOutline } from "@makeplane/propel/icons";
// plane helpers
import { EIssueLayoutTypes } from "@plane/types";
// types
import { useTranslation } from "@plane/i18n";
import type { TModuleFilters, TModuleLayoutOptions } from "@plane/types";
// ui
import { calculateTotalFilters } from "@plane/utils";
// plane utils
// components
import { ModuleFiltersDropdown } from "./dropdowns/filters/root";
import { ModuleOrderByDropdown } from "@/components/modules/dropdowns";
// constants
// helpers
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useModuleFilter } from "@/hooks/store/use-module-filter";
import { LayoutSelection } from "@/components/issues/issue-layouts/filters/header/layout-selection";
import { MobileLayoutSelection } from "@/components/issues/issue-layouts/filters/header/mobile-layout-selection";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
// i18n

const moduleIssueLayouts = [EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN, EIssueLayoutTypes.GANTT];

export const ModuleViewHeader = observer(function ModuleViewHeader() {
  // refs
  // router
  const { projectId } = useParams();
  // hooks
  // store hooks
  const {
    workspace: { workspaceMemberIds },
  } = useMember();
  const {
    currentProjectDisplayFilters: displayFilters,
    currentProjectFilters: filters,
    searchQuery,
    updateDisplayFilters,
    updateFilters,
    updateSearchQuery,
  } = useModuleFilter();
  const { t } = useTranslation();

  // states

  // handlers
  const handleFilters = useCallback(
    (key: keyof TModuleFilters, value: string | string[]) => {
      if (!projectId) return;
      const newValues = [...(filters?.[key] ?? [])];
      const newValuesSet = new Set(newValues);

      if (Array.isArray(value))
        value.forEach((val) => {
          if (!newValuesSet.has(val)) {
            newValues.push(val);
            newValuesSet.add(val);
          } else {
            newValues.splice(newValues.indexOf(val), 1);
            newValuesSet.delete(val);
          }
        });
      else {
        if (filters?.[key]?.includes(value)) newValues.splice(newValues.indexOf(value), 1);
        else newValues.push(value);
      }

      updateFilters(projectId.toString(), { [key]: newValues });
    },
    [filters, projectId, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters ?? {}) !== 0 || displayFilters?.favorites;

  const selectedLayout =
    displayFilters?.layout === "board"
      ? EIssueLayoutTypes.KANBAN
      : displayFilters?.layout === "gantt"
        ? EIssueLayoutTypes.GANTT
        : EIssueLayoutTypes.LIST;
  const changeLayout = (layout: EIssueLayoutTypes) => {
    const value: TModuleLayoutOptions =
      layout === EIssueLayoutTypes.KANBAN ? "board" : layout === EIssueLayoutTypes.GANTT ? "gantt" : "list";
    if (projectId && value !== displayFilters?.layout) updateDisplayFilters(projectId.toString(), { layout: value });
  };

  return (
    <div className="hidden h-full items-center gap-2 self-end sm:flex">
      <ExpandableSearch
        size="md"
        aria-label={t("common.search.label")}
        placeholder={t("common.search.label")}
        clearLabel={t("common.clear")}
        value={searchQuery}
        onValueChange={(value) => updateSearchQuery(value ?? "")}
      />
      <div className="hidden @5xl:block">
        <LayoutSelection
          layoutOverrides={{
            [EIssueLayoutTypes.KANBAN]: {
              label: t("project_modules.layout.board"),
              icon: <CardLayoutOutline className="size-4" />,
            },
          }}
          layouts={moduleIssueLayouts}
          selectedLayout={selectedLayout}
          onChange={changeLayout}
        />
      </div>
      <div className="@5xl:hidden">
        <MobileLayoutSelection
          layoutOverrides={{
            [EIssueLayoutTypes.KANBAN]: {
              label: t("project_modules.layout.board"),
              icon: <CardLayoutOutline className="size-4" />,
            },
          }}
          layouts={moduleIssueLayouts}
          activeLayout={selectedLayout}
          onChange={changeLayout}
        />
      </div>
      <ModuleOrderByDropdown
        value={displayFilters?.order_by}
        onChange={(val) => {
          if (!projectId || val === displayFilters?.order_by) return;
          updateDisplayFilters(projectId.toString(), {
            order_by: val,
          });
        }}
      />
      <ModuleFiltersDropdown
        isFiltersApplied={isFiltersApplied}
        displayFilters={displayFilters ?? {}}
        filters={filters ?? {}}
        handleDisplayFiltersUpdate={(val) => {
          if (!projectId) return;
          updateDisplayFilters(projectId.toString(), val);
        }}
        handleFiltersUpdate={handleFilters}
        memberIds={workspaceMemberIds ?? undefined}
      />
    </div>
  );
});
