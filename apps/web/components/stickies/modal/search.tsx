/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { debounce } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { useTranslation } from "@plane/i18n";
import { useSticky } from "@/hooks/use-stickies";

export const StickySearch = observer(function StickySearch() {
  const { workspaceSlug } = useParams();
  const { searchQuery, updateSearchQuery, fetchWorkspaceStickies } = useSticky();
  const { t } = useTranslation();
  const slug = workspaceSlug.toString();
  const debouncedSearch = useMemo(
    () => debounce(() => fetchWorkspaceStickies(slug), 500),
    [fetchWorkspaceStickies, slug]
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  return (
    <ExpandableSearch
      size="md"
      aria-label={t("stickies.search_placeholder")}
      clearLabel={t("common.clear")}
      placeholder={t("stickies.search_placeholder")}
      value={searchQuery}
      onValueChange={(value) => {
        updateSearchQuery(value);
        debouncedSearch.cancel();
        if (value.trim()) debouncedSearch();
        else void fetchWorkspaceStickies(slug);
      }}
    />
  );
});
