/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IIssueDisplayProperties } from "@plane/types";

/** Properties the card shows in its footer, right of the assignees: the "when" and the attachments. */
const FOOTER_PROPERTIES = ["due_date", "attachment_count", "link"] as const satisfies (keyof IIssueDisplayProperties)[];

/**
 * Splits the user's display properties between the card body (state, labels, estimate, …) and its
 * footer (due date, attachment and link counts); the priority moves up beside the
 * identifier and the state becomes an icon in front of the title. The sub-work item count leaves the pill row: the card shows it as a progress row
 * instead. Hidden properties stay hidden everywhere.
 */
export function splitKanbanCardProperties(displayProperties: IIssueDisplayProperties | undefined): {
  body: IIssueDisplayProperties | undefined;
  header: IIssueDisplayProperties;
  /** Show the state as an icon in front of the title, in place of a pill. */
  showStateIcon: boolean;
  /** Show the labels as their own wrapping row of chips. */
  showLabels: boolean;
  footer: IIssueDisplayProperties;
  showFooterProperties: boolean;
  showProgress: boolean;
} {
  const footer: IIssueDisplayProperties = {};
  for (const key of FOOTER_PROPERTIES) footer[key] = !!displayProperties?.[key];

  const body = displayProperties && {
    ...displayProperties,
    ...Object.fromEntries(FOOTER_PROPERTIES.map((key) => [key, false])),
    priority: false,
    state: false,
    labels: false,
    sub_issue_count: false,
  };

  return {
    body,
    header: { priority: !!displayProperties?.priority },
    showStateIcon: !!displayProperties?.state,
    showLabels: !!displayProperties?.labels,
    footer,
    showFooterProperties: FOOTER_PROPERTIES.some((key) => footer[key]),
    showProgress: !!displayProperties?.sub_issue_count,
  };
}
