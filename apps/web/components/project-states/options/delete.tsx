/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { MenuItem } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { CloseOutline, LoadingOutline } from "@makeplane/propel/icons";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateOperationsCallbacks } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import { getWorkflowErrorCode } from "@/helpers/workflow";

type TStateDelete = {
  totalStates: number;
  state: IState;
  deleteStateCallback: TStateOperationsCallbacks["deleteState"];
  /** Keep the dialog outside the menu's unmounting content. */
  renderMenu?: (deleteAction: ReactNode) => ReactNode;
};

export const StateDelete = observer(function StateDelete(props: TStateDelete) {
  const { totalStates, state, deleteStateCallback, renderMenu } = props;
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { isMobile } = usePlatformOS();
  // states
  const [isDeleteModal, setIsDeleteModal] = useState(false);
  const [isDelete, setIsDelete] = useState(false);
  // derived values
  const isDeleteDisabled = Boolean(state.default) || totalStates === 1;

  const handleDeleteState = async () => {
    if (isDeleteDisabled) return;

    setIsDelete(true);

    try {
      await deleteStateCallback(state.id);
      setIsDeleteModal(false);
      setIsDelete(false);
    } catch (error) {
      const errorStatus = error as { status: number; data: { error: string } };
      const workflowCode = getWorkflowErrorCode(error);
      if (workflowCode) {
        setToast({ type: "error", title: t("toast.error"), message: t(`web.workflow_errors.${workflowCode}`) });
      } else if (errorStatus.status === 400) {
        setToast({
          type: "error",
          title: t("toast.error"),
          message: t("web.this_state_contains_some_work_items_within_it_please_move_th"),
        });
      } else {
        setToast({
          type: "error",
          title: t("toast.error"),
          message: t("web.state_could_not_be_deleted_please_try_again"),
        });
      }
      setIsDelete(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        handleClose={() => setIsDeleteModal(false)}
        handleSubmit={handleDeleteState}
        isSubmitting={isDelete}
        isOpen={isDeleteModal}
        title={t("web.delete_state")}
        content={
          <>
            <Translation
              translationKey="web.ui.delete_state_confirm"
              components={{ name: <span className="font-medium text-primary">{state?.name}</span> }}
            />
          </>
        }
      />

      {renderMenu ? (
        renderMenu(
          <MenuItem
            variant="danger"
            label={t("common.actions.delete")}
            disabled={isDeleteDisabled}
            onClick={() => {
              if (isDeleteDisabled) return;
              setIsDeleteModal(true);
            }}
          />
        )
      ) : (
        <Tooltip
          label={
            state.default
              ? t("web.cannot_delete_the_default_state")
              : totalStates === 1
                ? t("web.cannot_have_an_empty_group")
                : ``
          }
          layout="stacked"
          disabled={!isDeleteDisabled || isMobile}
        >
          {/* Not `disabled`: a disabled button would never show the tooltip that explains why. */}
          <IconButton
            variant="ghost"
            size="xs"
            aria-label={t("common.delete")}
            aria-disabled={isDeleteDisabled}
            icon={
              isDelete ? (
                <Icon icon={<LoadingOutline className="animate-spin text-secondary" />} />
              ) : (
                <Icon icon={<CloseOutline className={cn({ "text-danger-primary": !isDeleteDisabled })} />} />
              )
            }
            onClick={() => {
              if (isDeleteDisabled) return;
              setIsDeleteModal(true);
            }}
          />
        </Tooltip>
      )}
    </>
  );
});
