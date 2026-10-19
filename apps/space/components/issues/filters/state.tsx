/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
// ui
import { EIconSize } from "@plane/constants";
import { StateGroupIcon } from "@plane/blocks/icons";
import { Loader } from "@plane/blocks/skeleton";
// hooks
import { useStates } from "@/hooks/store/use-state";
// local imports
import { FilterHeader } from "./helpers/filter-header";
import { FilterOption } from "./helpers/filter-option";
import { translate } from "@plane/i18n";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
};

export const FilterState = observer(function FilterState(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery } = props;

  const { sortedStates: states } = useStates();

  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const appliedFiltersSet = useMemo(() => new Set(appliedFilters ?? []), [appliedFilters]);

  const filteredOptions = states?.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleViewToggle = () => {
    if (!filteredOptions) return;

    if (itemsToRender === filteredOptions.length) setItemsToRender(5);
    else setItemsToRender(filteredOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={translate("web.runtime.filter_state", { count: appliedFiltersCount })}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredOptions ? (
            filteredOptions.length > 0 ? (
              <>
                {filteredOptions.slice(0, itemsToRender).map((state) => (
                  <FilterOption
                    key={state.id}
                    isChecked={appliedFiltersSet.has(state.id)}
                    onClick={() => handleUpdate(state.id)}
                    icon={<StateGroupIcon stateGroup={state.group} color={state.color} size={EIconSize.MD} />}
                    title={state.name}
                  />
                ))}
                {filteredOptions.length > 5 && (
                  <button
                    type="button"
                    className="ml-8 text-11 font-medium text-accent-primary"
                    onClick={handleViewToggle}
                  >
                    {itemsToRender === filteredOptions.length ? translate("web.view_less") : translate("web.view_all")}
                  </button>
                )}
              </>
            ) : (
              <p className="text-11 text-placeholder italic">{translate("web.no_matches_found")}</p>
            )
          ) : (
            <Loader className="space-y-2">
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
            </Loader>
          )}
        </div>
      )}
    </>
  );
});
