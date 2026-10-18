/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { translate } from "@plane/i18n";
import { MemberFilter } from "@/components/common/filters/member-filter";
import type { MemberFilterProps } from "@/components/common/filters/member-filter";

export const FilterCreatedBy = observer(function FilterCreatedBy(props: MemberFilterProps) {
  return (
    <MemberFilter
      {...props}
      field="created_by"
      title={translate("web.runtime.filter_created_by", { count: props.appliedFilters?.length ?? 0 })}
      optionKeyPrefix="created-by"
    />
  );
});
