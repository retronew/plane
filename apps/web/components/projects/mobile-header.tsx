/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import HeaderFilters from "@/components/project/filters";

/** Keep mobile filtering and sorting on the same menu/state contract as desktop. */
export function ProjectsListMobileHeader() {
  return (
    <div className="flex w-full justify-center border-b border-subtle bg-surface-1 py-2 md:hidden">
      <HeaderFilters />
    </div>
  );
}
