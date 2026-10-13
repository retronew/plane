/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BlockingOutline, CloseCircleOutline, DuplicateOfOutline, RelatesToOutline } from "@makeplane/propel/icons";
import type { TRelationObject } from "@/components/issues/issue-detail-widgets/relations";
import type { TIssueRelationTypes } from "@plane/types";
import { translate } from "@plane/i18n";

export const ISSUE_RELATION_OPTIONS: Record<TIssueRelationTypes, TRelationObject> = {
  relates_to: {
    key: "relates_to",
    i18n_label: "issue.relation.relates_to",
    className: "bg-layer-1 text-secondary",
    icon: (size) => <RelatesToOutline height={size} width={size} className="text-secondary" />,
    get placeholder() {
      return translate("web.add_related_work_items");
    },
  },
  duplicate: {
    key: "duplicate",
    i18n_label: "issue.relation.duplicate",
    className: "bg-layer-1 text-secondary",
    icon: (size) => <DuplicateOfOutline width={size} height={size} className="text-secondary" />,
    get placeholder() {
      return translate("web.none");
    },
  },
  blocked_by: {
    key: "blocked_by",
    i18n_label: "issue.relation.blocked_by",
    className: "bg-danger-subtle text-danger-primary",
    icon: (size) => <BlockingOutline width={size} height={size} className="text-secondary" />,
    get placeholder() {
      return translate("web.none");
    },
  },
  blocking: {
    key: "blocking",
    i18n_label: "issue.relation.blocking",
    className: "bg-yellow-500/20 text-yellow-700",
    icon: (size) => <CloseCircleOutline width={size} height={size} className="text-secondary" />,
    get placeholder() {
      return translate("web.none");
    },
  },
};

export const useTimeLineRelationOptions = () => ISSUE_RELATION_OPTIONS;
