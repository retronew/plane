/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { translate } from "@plane/i18n";
import { MemberFilter } from "@/components/common/filters/member-filter";
import type { MemberFilterProps } from "@/components/common/filters/member-filter";

export const FilterLead = observer(function FilterLead(props: MemberFilterProps) {
  return (
    <MemberFilter
      {...props}
      field="lead"
      title={translate("web.runtime.filter_lead", { count: props.appliedFilters?.length ?? 0 })}
      optionKeyPrefix="lead"
    />
  );
});
