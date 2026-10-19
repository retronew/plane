import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// lucide icons
import { Circle } from "lucide-react";
import { AddOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import type { TIssue, ISearchIssueResponse, TIssueGroupByOptions } from "@plane/types";
import { useTranslation } from "@plane/i18n";
// ui
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
// constants
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

interface IHeaderGroupByCard {
  sub_group_by: TIssueGroupByOptions | undefined;
  group_by: TIssueGroupByOptions | undefined;
  column_id: string;
  icon?: React.ReactNode;
  title: string;
  count: number;
  issuePayload: Partial<TIssue>;
  disableIssueCreation?: boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
}

export const HeaderGroupByCard = observer(function HeaderGroupByCard(props: IHeaderGroupByCard) {
  const { icon, title, count, issuePayload, disableIssueCreation, addIssuesToView } = props;
  // plane hooks
  const { t } = useTranslation();
  // states
  const [isOpen, setIsOpen] = React.useState(false);
  const [openExistingIssueListModal, setOpenExistingIssueListModal] = React.useState(false);
  // hooks
  const storeType = useIssueStoreType();
  // router
  const { workspaceSlug, projectId, moduleId, cycleId } = useParams();

  const renderExistingIssueModal = moduleId || cycleId;
  const ExistingIssuesListModalPayload = moduleId ? { module: moduleId.toString() } : { cycle: true };

  const handleAddIssuesToView = async (data: ISearchIssueResponse[]) => {
    if (!workspaceSlug || !projectId) return;

    const issues = data.map((i) => i.id);

    try {
      await addIssuesToView?.(issues);

      setToast({
        type: "success",
        title: t("toast.success"),
        message: t("web.work_items_added_to_the_cycle_successfully"),
      });
    } catch (_error) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.selected_work_items_could_not_be_added_to_the_cycle_please_t"),
      });
    }
  };

  return (
    <>
      <CreateUpdateIssueModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        data={issuePayload}
        storeType={storeType}
      />

      {renderExistingIssueModal && (
        <ExistingIssuesListModal
          workspaceSlug={workspaceSlug?.toString()}
          projectId={projectId?.toString()}
          isOpen={openExistingIssueListModal}
          handleClose={() => setOpenExistingIssueListModal(false)}
          searchParams={ExistingIssuesListModalPayload}
          handleOnSubmit={handleAddIssuesToView}
        />
      )}
      <div className="relative flex w-full shrink-0 items-center gap-1 py-1.5">
        <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-xs">
          {icon ?? <Circle width={14} strokeWidth={2} />}
        </div>
        <div className="relative flex w-full items-baseline gap-1 overflow-hidden">
          <div className="line-clamp-1 truncate text-body-sm-medium text-primary">{title}</div>
          <div className="shrink-0 pl-2 text-13 font-medium text-tertiary">{count || 0}</div>
        </div>

        {!disableIssueCreation &&
          (renderExistingIssueModal ? (
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("common.add")}
                    className="flex h-[20px] w-[20px] flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-sm bg-layer-transparent transition-all hover:bg-layer-transparent-hover"
                  >
                    <AddOutline height={14} width={14} />
                  </button>
                }
              />
              <MenuContent side="bottom" align="end">
                <MenuItem
                  label={t("web.create_work_item")}
                  onClick={() => {
                    setIsOpen(true);
                  }}
                />
                <MenuItem
                  label={t("web.add_an_existing_work_item")}
                  onClick={() => {
                    setOpenExistingIssueListModal(true);
                  }}
                />
              </MenuContent>
            </Menu>
          ) : (
            <button
              type="button"
              aria-label={t("common.add")}
              className="flex h-[20px] w-[20px] flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-sm bg-layer-transparent transition-all hover:bg-layer-transparent-hover"
              onClick={() => {
                setIsOpen(true);
              }}
            >
              <AddOutline width={14} />
            </button>
          ))}
      </div>
    </>
  );
});
