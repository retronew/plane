import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { SortAscendingOutline, SortDescendingOutline } from "@makeplane/propel/icons";
import { INBOX_ISSUE_ORDER_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { SortMenuItems } from "@/components/common/sort-menu";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import type { TInboxIssueSortingOrderByKeys, TInboxIssueSortingSortByKeys } from "@plane/types";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";

export const InboxIssueOrderByDropdown = observer(function InboxIssueOrderByDropdown() {
  // hooks
  const { t } = useTranslation();
  const { inboxSorting, handleInboxIssueSorting } = useProjectInbox();
  const orderByDetails =
    INBOX_ISSUE_ORDER_BY_OPTIONS.find((option) => inboxSorting?.order_by?.includes(option.key)) || undefined;
  const orderByLabel = t(orderByDetails?.i18n_label || "inbox_issue.order_by.created_at");
  const sortIcon =
    inboxSorting?.sort_by === "asc" ? (
      <SortAscendingOutline className="size-3" />
    ) : (
      <SortDescendingOutline className="size-3" />
    );
  // The trigger is the native button itself, so the styled element grafts straight onto it.
  const triggerButton = (
    <ButtonElement variant="secondary" size="md" stretch="auto" aria-label={t("common.order_by.label")}>
      {sortIcon}
      {orderByLabel}
    </ButtonElement>
  );
  return (
    <Menu>
      <MenuTrigger render={triggerButton} />
      <MenuContent side="bottom" align="end">
        <SortMenuItems
          field={inboxSorting?.order_by ?? "created_at"}
          direction={inboxSorting?.sort_by ?? "desc"}
          options={INBOX_ISSUE_ORDER_BY_OPTIONS.map((option) => ({ value: option.key, label: t(option.i18n_label) }))}
          onFieldChange={(key) => handleInboxIssueSorting("order_by", key as TInboxIssueSortingOrderByKeys)}
          onDirectionChange={(direction) =>
            handleInboxIssueSorting("sort_by", direction as TInboxIssueSortingSortByKeys)
          }
        />
      </MenuContent>
    </Menu>
  );
});
