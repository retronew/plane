/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueActivity } from "@plane/types";
import { translate } from "@plane/i18n";

export const getRelationActivityContent = (activity: TIssueActivity | undefined): string | undefined => {
  if (!activity) return;

  switch (activity.field) {
    case "blocking":
      return activity.old_value === ""
        ? translate("web.marked_this_work_item_is_blocking_work_item")
        : translate("web.removed_the_blocking_work_item");
    case "blocked_by":
      return activity.old_value === ""
        ? translate("web.marked_this_work_item_is_being_blocked_by")
        : translate("web.removed_this_work_item_being_blocked_by_work_item");
    case "duplicate":
      return activity.old_value === ""
        ? translate("web.marked_this_work_item_as_duplicate_of")
        : translate("web.removed_this_work_item_as_a_duplicate_of");
    case "relates_to":
      return activity.old_value === ""
        ? translate("web.marked_that_this_work_item_relates_to")
        : translate("web.removed_the_relation_from");
  }

  return;
};
