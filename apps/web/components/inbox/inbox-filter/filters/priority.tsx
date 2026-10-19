/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { PriorityIcon } from "@plane/blocks/icons";
import type { TIssuePriorities } from "@plane/types";
// plane constants
// components
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";

type Props = {
  searchQuery: string;
};

export const FilterPriority = observer(function FilterPriority(props: Props) {
  const { searchQuery } = props;
  // hooks
  const { t } = useTranslation();
  const { inboxFilters, handleInboxIssueFilters } = useProjectInbox();
  // states
  const [previewEnabled, setPreviewEnabled] = useState(true);
  // derived values
  const rawFilterValue = inboxFilters?.priority;
  const filterValue = rawFilterValue || [];
  const filterValueSet = useMemo(() => new Set(rawFilterValue ?? []), [rawFilterValue]);
  const appliedFiltersCount = filterValue?.length ?? 0;
  const filteredOptions = ISSUE_PRIORITIES.filter((p) => p.key.includes(searchQuery.toLowerCase()));

  const handleFilterValue = (value: TIssuePriorities): TIssuePriorities[] =>
    filterValue?.includes(value) ? filterValue.filter((v) => v !== value) : [...filterValue, value];

  return (
    <>
      <FilterHeader
        field="priority"
        title={translate("web.runtime.filter_priority", { count: appliedFiltersCount })}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((priority) => (
              <FilterOption
                key={priority.key}
                isChecked={filterValueSet.has(priority.key)}
                onClick={() => handleInboxIssueFilters("priority", handleFilterValue(priority.key))}
                icon={<PriorityIcon priority={priority.key} className="h-3.5 w-3.5" />}
                title={priority.title}
              />
            ))
          ) : (
            <p className="text-11 text-placeholder italic">{t("common.search.no_matches_found")}</p>
          )}
        </div>
      )}
    </>
  );
});
