import { ISSUE_PRIORITIES } from "@plane/constants";
import { useParams } from "react-router";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation, translate } from "@plane/i18n";
import { ProjectFilterChip } from "./chip";
import { PriorityIcon } from "@plane/blocks/icons";
import { ProjectStatusIcon } from "../project-status-icon";
import type { TIssuePriorities } from "@plane/types";
import { Badge } from "@makeplane/propel/components/badge";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TProjectAppliedDisplayFilterKeys, TProjectFilters } from "@plane/types";
import { EHeaderVariant, Header } from "@plane/blocks/layout";

// local imports
import { AppliedAccessFilters } from "./access";
import { AppliedDateFilters } from "./date";
import { AppliedMembersFilters } from "./members";
import { AppliedProjectDisplayFilters } from "./project-display-filters";

type Props = {
  appliedFilters: TProjectFilters;
  appliedDisplayFilters: TProjectAppliedDisplayFilterKeys[];
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TProjectFilters, value: string | null) => void;
  handleRemoveDisplayFilter: (key: TProjectAppliedDisplayFilterKeys) => void;
  alwaysAllowEditing?: boolean;
  filteredProjects: number;
  totalProjects: number;
};

/** The retired `Tag` chrome: a bordered container for one filter's label, its chips and its
 *  remove button. Not a `Pill`: that takes a label string and cannot hold nested interactive children. */
const FILTER_GROUP_CLASSNAME =
  "my-auto flex min-h-7 flex-wrap items-center gap-1.5 rounded-md border border-subtle-1 bg-layer-2 px-2 py-0.5 text-11 text-tertiary";

const FILTER_LABELS: Record<keyof TProjectFilters, string> = {
  status: "web.project_statuses",
  labels: "web.project_labels",
  priority: "priority",
  access: "web.project_page.access",
  lead: "lead",
  members: "common.members",
  created_at: "web.created_date",
};

const MEMBERS_FILTERS = new Set(["lead", "members"]);
const DATE_FILTERS = new Set(["created_at"]);

export function ProjectAppliedFiltersList(props: Props) {
  const { t } = useTranslation();
  const { workspaceSlug = "" } = useParams();
  const categories = useProjectCategories(workspaceSlug);
  const {
    appliedFilters,
    appliedDisplayFilters,
    handleClearAllFilters,
    handleRemoveFilter,
    handleRemoveDisplayFilter,
    alwaysAllowEditing,
    filteredProjects,
    totalProjects,
  } = props;

  if (!appliedFilters && !appliedDisplayFilters) return null;
  if (Object.values(appliedFilters).every((values) => !values?.length) && appliedDisplayFilters.length === 0)
    return null;

  const isEditingAllowed = alwaysAllowEditing;

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <Header.LeftItem>
        {/* Applied filters */}
        {Object.entries(appliedFilters ?? {}).map(([key, value]) => {
          const filterKey = key as keyof TProjectFilters;

          if (!value || (filterKey === "status" && !categories.statesEnabled)) return;
          if (Array.isArray(value) && value.length === 0) return;

          return (
            <div key={filterKey} className={FILTER_GROUP_CLASSNAME}>
              <span className="text-11 text-tertiary">{t(FILTER_LABELS[filterKey])}</span>
              <div className="flex flex-wrap items-center gap-1">
                {filterKey === "priority" &&
                  value.map((id) => (
                    <ProjectFilterChip
                      key={id}
                      label={ISSUE_PRIORITIES.find((entry) => entry.key === id)?.title ?? id}
                      icon={<PriorityIcon priority={id as TIssuePriorities} className="size-3" />}
                      onRemove={isEditingAllowed ? () => handleRemoveFilter("priority", id) : undefined}
                    />
                  ))}
                {(filterKey === "status" || filterKey === "labels") &&
                  value.map((id) => {
                    const entry = (filterKey === "status" ? categories.statuses : categories.labels).find(
                      (item) => item.id === id
                    );
                    return (
                      <ProjectFilterChip
                        key={id}
                        label={entry?.name ?? t("web.configuration_deleted_filter")}
                        icon={
                          entry ? (
                            filterKey === "status" ? (
                              <ProjectStatusIcon group={entry.group} color={entry.color} />
                            ) : entry.color ? (
                              <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                            ) : undefined
                          ) : undefined
                        }
                        onRemove={isEditingAllowed ? () => handleRemoveFilter(filterKey, id) : undefined}
                      />
                    );
                  })}
                {filterKey === "access" && (
                  <AppliedAccessFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter("access", val)}
                    values={value}
                  />
                )}
                {DATE_FILTERS.has(filterKey) && (
                  <AppliedDateFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
                  />
                )}
                {MEMBERS_FILTERS.has(filterKey) && (
                  <AppliedMembersFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
                  />
                )}
                {isEditingAllowed && (
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label={`${t("remove")} ${t(FILTER_LABELS[filterKey])}`}
                    icon={<CloseOutline />}
                    onClick={() => handleRemoveFilter(filterKey, null)}
                  />
                )}
              </div>
            </div>
          );
        })}
        {/* Applied display filters */}
        {appliedDisplayFilters.length > 0 && (
          <div key="project_display_filters" className={FILTER_GROUP_CLASSNAME}>
            <span className="text-11 text-tertiary">{t("common.projects")}</span>
            <AppliedProjectDisplayFilters
              editable={isEditingAllowed}
              values={appliedDisplayFilters}
              handleRemove={(key) => handleRemoveDisplayFilter(key)}
            />
          </div>
        )}
        {isEditingAllowed && (
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            label={t("common.clear_all")}
            onClick={handleClearAllFilters}
          />
        )}
      </Header.LeftItem>
      <Header.RightItem>
        <Tooltip
          label={translate("web.runtime.matching_projects", { matched: filteredProjects, total: totalProjects })}
          layout="stacked"
        >
          <Badge size="sm" variant="neutral" label={`${filteredProjects}/${totalProjects}`} />
        </Tooltip>
      </Header.RightItem>
    </Header>
  );
}
