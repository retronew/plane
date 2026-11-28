/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { CloseOutline } from "@makeplane/propel/icons";
// plane imports
import type { EViewAccess, TViewFilterProps } from "@plane/types";
import { replaceUnderscoreIfSnakeCase } from "@plane/utils";
// components
import { AppliedDateFilters } from "@/components/common/applied-filters/date";
import { AppliedMembersFilters } from "@/components/common/applied-filters/members";
// local imports
import { AppliedAccessFilters } from "./access";

type Props = {
  appliedFilters: TViewFilterProps;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TViewFilterProps, value: string | EViewAccess | null) => void;
  alwaysAllowEditing?: boolean;
};

/** Compact bordered container for one filter's label, its chips and its remove button. */
const FILTER_GROUP_CLASSNAME =
  "my-auto flex min-h-7 flex-wrap items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 py-1 text-11 text-tertiary";

const MEMBERS_FILTERS = new Set(["owned_by"]);
const DATE_FILTERS = new Set(["created_at"]);
const VIEW_ACCESS_FILTERS = new Set(["view_type"]);

const VIEW_FILTER_LABEL_KEYS: Partial<Record<keyof TViewFilterProps, string>> = {
  view_type: "common.access.label",
  owned_by: "common.created_by",
  created_at: "common.created_on",
  favorites: "web.favorite",
};

export function ViewAppliedFiltersList(props: Props) {
  const { appliedFilters, handleClearAllFilters, handleRemoveFilter, alwaysAllowEditing } = props;
  const { t } = useTranslation();

  if (!appliedFilters) return null;
  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed = alwaysAllowEditing;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-surface-1">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof TViewFilterProps;

        if (!value) return;
        if (Array.isArray(value) && value.length === 0) return;

        const labelKey = VIEW_FILTER_LABEL_KEYS[filterKey];
        const filterLabel = labelKey ? t(labelKey) : replaceUnderscoreIfSnakeCase(filterKey);

        return (
          <div key={filterKey} className={FILTER_GROUP_CLASSNAME}>
            <span className="text-11 text-tertiary">{filterLabel}</span>
            {VIEW_ACCESS_FILTERS.has(filterKey) && (
              <AppliedAccessFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                values={Array.isArray(value) ? (value as EViewAccess[]) : []}
              />
            )}
            {DATE_FILTERS.has(filterKey) && (
              <AppliedDateFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                values={Array.isArray(value) ? (value as string[]) : []}
              />
            )}
            {MEMBERS_FILTERS.has(filterKey) && (
              <AppliedMembersFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                values={Array.isArray(value) ? (value as string[]) : []}
                chipClassName="px-1.5 py-0.5"
              />
            )}
            {isEditingAllowed && (
              <button
                type="button"
                aria-label={t("common.remove")}
                className="grid cursor-pointer place-items-center text-tertiary hover:text-primary"
                onClick={() => handleRemoveFilter(filterKey, null)}
              >
                <CloseOutline height={12} width={12} />
              </button>
            )}
          </div>
        );
      })}
      {isEditingAllowed && (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t("common.clear_all")}
          onClick={handleClearAllFilters}
        />
      )}
    </div>
  );
}
