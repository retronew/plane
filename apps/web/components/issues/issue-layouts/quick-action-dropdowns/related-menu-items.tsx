/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { useState } from "react";
import {
  PlusSquareOutline,
  RelationsOutline,
  SubscribeOutline,
  SubWorkItemsOutline,
  UnsubscribeOutline,
} from "@makeplane/propel/icons";
// plane imports
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { ISearchIssueResponse, TIssue, TIssueRelationTypes } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
import { ISSUE_RELATION_OPTIONS } from "@/components/relations";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { useSubIssueOperations } from "../../issue-detail-widgets/sub-issues/helper";
import { CreateUpdateIssueModal } from "../../issue-modal/modal";

const RELATION_ORDER: TIssueRelationTypes[] = ["relates_to", "blocked_by", "blocking", "duplicate"];

type TRelatedMenuHandlers = {
  /** `undefined` until the subscription has been fetched for this work item. */
  isSubscribed: boolean | undefined;
  openCreateSubWorkItem: () => void;
  openAddExistingSubWorkItems: () => void;
  openRelation: (relationType: TIssueRelationTypes) => void;
  toggleSubscription: () => void;
  prefetchSubscription: () => void;
};

/**
 * Linear's "Create related" and notification rows: add a sub-work item (new or existing), relate
 * the work item to others, and subscribe or unsubscribe. The subscription is only known after a
 * fetch, so that row appears once the menu has opened and loaded it.
 */
export function buildRelatedMenuItems(
  props: TRelatedMenuHandlers & { isEditingAllowed: boolean; t: (key: string) => string }
): TContextMenuItem[] {
  const { isEditingAllowed, t, isSubscribed } = props;

  return [
    {
      key: "add-sub-work-item",
      section: "edit",
      title: t("issue.add.sub_issue"),
      icon: SubWorkItemsOutline,
      action: () => {},
      shouldRender: isEditingAllowed,
      nestedMenuItems: [
        {
          key: "sub-work-item-create",
          title: t("common.create_new"),
          icon: PlusSquareOutline,
          action: props.openCreateSubWorkItem,
        },
        {
          key: "sub-work-item-existing",
          title: t("common.add_existing"),
          icon: SubWorkItemsOutline,
          action: props.openAddExistingSubWorkItems,
        },
      ],
    },
    {
      key: "add-relation",
      section: "edit",
      title: t("issue.add.relation"),
      icon: RelationsOutline,
      action: () => {},
      shouldRender: isEditingAllowed,
      nestedMenuItems: RELATION_ORDER.map((relationType) => ({
        key: `relation-${relationType}`,
        title: t(ISSUE_RELATION_OPTIONS[relationType].i18n_label),
        customContent: ISSUE_RELATION_OPTIONS[relationType].icon(14),
        action: () => props.openRelation(relationType),
      })),
    },
    {
      key: "subscription",
      section: "notify",
      title: isSubscribed ? t("common.actions.unsubscribe") : t("common.actions.subscribe"),
      icon: isSubscribed ? UnsubscribeOutline : SubscribeOutline,
      action: props.toggleSubscription,
      onMenuOpen: props.prefetchSubscription,
      shouldRender: isSubscribed !== undefined,
    },
  ];
}

type TUseRelatedMenuItemsProps = {
  issue: TIssue;
  workspaceSlug: string | undefined;
  isEditingAllowed: boolean;
};

/** Store-backed rows plus the modals they open; render `modals` next to the quick-action menu. */
export const useRelatedMenuItems = (
  props: TUseRelatedMenuItemsProps
): { menuItems: TContextMenuItem[]; modals: React.ReactNode } => {
  const { issue, workspaceSlug, isEditingAllowed } = props;
  const projectId = issue.project_id ?? undefined;
  // states
  const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
  const [isExistingSubOpen, setIsExistingSubOpen] = useState(false);
  const [relationType, setRelationType] = useState<TIssueRelationTypes | null>(null);
  // store hooks
  const { t } = useTranslation();
  const {
    subscription: { getSubscriptionByIssueId },
    fetchSubscriptions,
    createSubscription,
    removeSubscription,
    createRelation,
  } = useIssueDetail(EIssueServiceType.ISSUES);
  const subIssueOperations = useSubIssueOperations(EIssueServiceType.ISSUES);
  // derived values
  const isSubscribed = getSubscriptionByIssueId(issue.id) ?? issue.is_subscribed;
  const canAct = !!workspaceSlug && !!projectId;

  const toggleSubscription = async () => {
    if (!workspaceSlug || !projectId) return;
    try {
      if (isSubscribed) await removeSubscription(workspaceSlug, projectId, issue.id);
      else await createSubscription(workspaceSlug, projectId, issue.id);
      setToast({
        type: "success",
        title: t("toast.success"),
        message: isSubscribed
          ? t("issue.subscription.actions.unsubscribed")
          : t("issue.subscription.actions.subscribed"),
      });
    } catch {
      setToast({ type: "error", title: t("toast.error"), message: t("common.error.message") });
    }
  };

  const handleRelationSubmit = async (data: ISearchIssueResponse[]) => {
    if (!workspaceSlug || !projectId || !relationType || data.length === 0) return;
    await createRelation(
      workspaceSlug,
      projectId,
      issue.id,
      relationType,
      data.map((item) => item.id)
    );
  };

  const menuItems = buildRelatedMenuItems({
    isEditingAllowed: isEditingAllowed && canAct,
    t,
    isSubscribed,
    openCreateSubWorkItem: () => setIsCreateSubOpen(true),
    openAddExistingSubWorkItems: () => setIsExistingSubOpen(true),
    openRelation: setRelationType,
    toggleSubscription: () => void toggleSubscription(),
    prefetchSubscription: () => {
      if (canAct && getSubscriptionByIssueId(issue.id) === undefined)
        void fetchSubscriptions(workspaceSlug, projectId, issue.id).catch(() => undefined);
    },
  });

  const modals = canAct ? (
    <>
      {isCreateSubOpen && (
        <CreateUpdateIssueModal
          isOpen={isCreateSubOpen}
          data={{ parent_id: issue.id, project_id: projectId }}
          onClose={() => setIsCreateSubOpen(false)}
          isProjectSelectionDisabled
        />
      )}
      <ExistingIssuesListModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        isOpen={isExistingSubOpen}
        handleClose={() => setIsExistingSubOpen(false)}
        searchParams={{ sub_issue: true, issue_id: issue.id }}
        handleOnSubmit={(data) =>
          subIssueOperations.addSubIssue(
            workspaceSlug,
            projectId,
            issue.id,
            data.map((item) => item.id)
          )
        }
      />
      <ExistingIssuesListModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        isOpen={relationType !== null}
        handleClose={() => setRelationType(null)}
        searchParams={{ issue_relation: true, issue_id: issue.id }}
        handleOnSubmit={handleRelationSubmit}
        workspaceLevelToggle
      />
    </>
  ) : null;

  return { menuItems, modals };
};
