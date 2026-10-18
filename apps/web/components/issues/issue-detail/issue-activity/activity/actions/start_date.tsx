/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { IssueDateActivity } from "./date-activity";

type TIssueStartDateActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueStartDateActivity = observer(function IssueStartDateActivity(props: TIssueStartDateActivity) {
  return (
    <IssueDateActivity
      {...props}
      setLabelKey="web.set_the_start_date_to"
      removedLabelKey="web.removed_the_start_date_2"
    />
  );
});
