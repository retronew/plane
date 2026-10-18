import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { AddOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import type { TIssue, TIssueServiceType } from "@plane/types";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
// components
import { handleTriggerClick, handleTriggerKeyDown } from "@/components/common/trigger-guard";
// hooks
import { useIssueHierarchy } from "@/hooks/use-issue-hierarchy";
import { issueTypeLevel, legalChildTypeIds } from "@/helpers/issue-hierarchy";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  issueId: string;
  /** Rendered as the trigger itself (not nested inside one); must forward ref and props to a `<button>`. */
  customButton?: React.ReactElement;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const SubIssuesActionButton = observer(function SubIssuesActionButton(props: Props) {
  const { issueId, customButton, disabled = false, issueServiceType } = props;
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById },
    toggleCreateIssueModal,
    toggleSubIssuesModal,
    setIssueCrudOperationState,
    issueCrudOperationState,
  } = useIssueDetail(issueServiceType);

  // derived values
  const issue = getIssueById(issueId);
  const { data: hierarchy } = useIssueHierarchy(issue?.project_id);
  const isLeaf = !!hierarchy?.enabled && issueTypeLevel(hierarchy.issue_types, issue?.type_id) === 0;
  const parentLevel = hierarchy ? issueTypeLevel(hierarchy.issue_types, issue?.type_id) : undefined;
  const noChildTypes =
    !!hierarchy?.enabled &&
    parentLevel !== undefined &&
    parentLevel > 0 &&
    legalChildTypeIds(hierarchy.issue_types, issue?.type_id).length === 0;

  if (!issue) return <></>;

  // handlers
  const handleIssueCrudState = (
    key: "create" | "existing",
    _parentIssueId: string | null,
    targetIssue: TIssue | null = null
  ) => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      [key]: {
        toggle: !issueCrudOperationState[key].toggle,
        parentIssueId: _parentIssueId,
        issue: targetIssue,
      },
    });
  };

  const handleCreateNew = () => {
    handleIssueCrudState("create", issueId, null);
    toggleCreateIssueModal(true);
  };

  const handleAddExisting = () => {
    handleIssueCrudState("existing", issueId, null);
    toggleSubIssuesModal(issue.id);
  };

  // options
  const optionItems = [
    {
      i18n_label: "common.create_new",
      icon: <AddOutline className="h-3 w-3" />,
      onClick: handleCreateNew,
    },
    {
      i18n_label: "common.add_existing",
      icon: <WorkItemsOutline className="h-3 w-3" />,
      onClick: handleAddExisting,
    },
  ];

  return (
    <Menu>
      {isLeaf && <span className="text-11 text-secondary">{t("web.issue_hierarchy.leaf_no_children")}</span>}
      {customButton ? (
        <MenuTrigger
          disabled={disabled || isLeaf}
          aria-disabled={disabled || isLeaf}
          render={customButton}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        />
      ) : (
        <MenuTrigger
          disabled={disabled || isLeaf}
          aria-disabled={disabled || isLeaf}
          aria-label={t("issue.add.sub_issue")}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        >
          <AddOutline className="h-4 w-4" />
        </MenuTrigger>
      )}
      <MenuContent side="bottom" align="start">
        {optionItems.map((item) => (
          <MenuItem
            key={item.i18n_label}
            icon={item.icon}
            label={t(item.i18n_label)}
            disabled={item.i18n_label === "common.create_new" && noChildTypes}
            description={
              item.i18n_label === "common.create_new" && noChildTypes
                ? t("web.issue_hierarchy.no_child_types")
                : undefined
            }
            onClick={(e) => {
              e.stopPropagation();
              if (!isLeaf) item.onClick();
            }}
          />
        ))}
      </MenuContent>
    </Menu>
  );
});
