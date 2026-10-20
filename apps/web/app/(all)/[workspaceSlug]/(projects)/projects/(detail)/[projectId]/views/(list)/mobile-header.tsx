/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// icons
// components
import { Row } from "@plane/blocks/layout";
import { ViewFiltersDropdown } from "@/components/views/filters/filter-selection";
import { ViewOrderByDropdown } from "@/components/views/filters/order-by";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProjectView } from "@/hooks/store/use-project-view";

export const ViewMobileHeader = observer(function ViewMobileHeader() {
  // store hooks
  const { filters, updateFilters } = useProjectView();
  const {
    project: { projectMemberIds },
  } = useMember();

  return (
    <>
      <div className="z-[13] flex justify-evenly border-b border-subtle bg-surface-1 py-2 md:hidden">
        <Row className="flex flex-grow items-center justify-center border-l border-subtle text-13 text-secondary">
          <ViewOrderByDropdown
            sortBy={filters.sortBy}
            sortKey={filters.sortKey}
            onChange={(val) => {
              if (val.key) updateFilters("sortKey", val.key);
              if (val.order) updateFilters("sortBy", val.order);
            }}
            isMobile
          />
        </Row>
        <div className="flex flex-grow items-center justify-center border-l border-subtle text-13 text-secondary">
          <ViewFiltersDropdown
            filters={filters}
            handleFiltersUpdate={updateFilters}
            memberIds={projectMemberIds ?? undefined}
          />
        </div>
      </div>
    </>
  );
});
