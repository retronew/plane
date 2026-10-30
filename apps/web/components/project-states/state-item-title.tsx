import { StateSummary } from "./state-summary";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type SetStateAction } from "react";
import { Switch } from "@makeplane/propel/components/switch";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { setToast } from "@plane/blocks/toast";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { DragDropOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateOperationsCallbacks } from "@plane/types";
// local imports
import { useProjectState } from "@/hooks/store/use-project-state";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { StateDelete } from "./options";
import { STATE_SWITCH_SLOT_CLASS_NAME } from "./row-layout";

type TBaseStateItemTitleProps = {
  stateCount: number;
  onEditColor?: () => void;
  dragHandleRef?: (element: Element | null) => void;
  state: IState;
  shouldShowDescription?: boolean;
  /** The state group is switched off, so this state's own switch follows it and cannot be changed. */
  groupClosed?: boolean;
  setUpdateStateModal: (value: SetStateAction<boolean>) => void;
};

type TEnabledStateItemTitleProps = TBaseStateItemTitleProps & {
  disabled: false;
  stateOperationsCallbacks: Pick<TStateOperationsCallbacks, "markStateAsDefault" | "deleteState" | "updateState">;
};

type TDisabledStateItemTitleProps = TBaseStateItemTitleProps & {
  disabled: true;
};

export type TStateItemTitleProps = TEnabledStateItemTitleProps | TDisabledStateItemTitleProps;

export const StateItemTitle = observer(function StateItemTitle(props: TStateItemTitleProps) {
  const {
    onEditColor,
    stateCount,
    dragHandleRef,
    setUpdateStateModal,
    disabled,
    state,
    shouldShowDescription = true,
    groupClosed = false,
  } = props;
  // plane hooks
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const [savingCreation, setSavingCreation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // store hooks
  const { getStatePercentageInGroup } = useProjectState();
  // derived values
  const statePercentage = getStatePercentageInGroup(state.id);
  const percentage = statePercentage ? statePercentage / 100 : undefined;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      {dragHandleRef && (
        <button
          type="button"
          ref={dragHandleRef}
          disabled={disabled || stateCount <= 1}
          hidden={disabled || stateCount <= 1}
          aria-label={`${t("web.reorder_category")} ${state.name}`}
          title={t("web.reorder_category_hint")}
          className="absolute -left-2.5 flex size-3 cursor-grab touch-none items-center justify-center rounded-xs text-placeholder opacity-0 transition-opacity group-focus-within:opacity-80 group-hover:opacity-60 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-strong active:cursor-grabbing"
        >
          <DragDropOutline className="size-3" />
        </button>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          if (onEditColor && event.target instanceof Element && event.target.closest("[data-state-color-target]"))
            onEditColor();
          else setUpdateStateModal(true);
        }}
        className="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        <StateSummary
          icon={
            <StateGroupIcon
              icon={state.icon}
              stateGroup={state.group}
              color={state.color}
              size={EIconSize.XL}
              percentage={percentage}
            />
          }
          color={state.color}
          name={state.name}
          badge={
            state.default ? (
              <span className="font-normal shrink-0 text-12 text-tertiary">· {t("web.project_status_default")}</span>
            ) : undefined
          }
          description={shouldShowDescription ? state.description : undefined}
        />
      </button>
      <span className={STATE_SWITCH_SLOT_CLASS_NAME}>
        <Tooltip
          label={groupClosed ? t("web.allow_new_work_items_locked_hint") : t("web.allow_new_work_items_hint")}
          disabled={isMobile}
        >
          <span className="flex">
            <Switch
              size="sm"
              aria-label={t("web.allow_new_work_items")}
              checked={!groupClosed && state.allow_new_work_items !== false}
              disabled={disabled || savingCreation || groupClosed}
              onCheckedChange={async (checked) => {
                if (props.disabled || savingCreation) return;
                setSavingCreation(true);
                try {
                  await props.stateOperationsCallbacks.updateState(state.id, { allow_new_work_items: checked });
                } catch {
                  setToast({ type: "error", title: t("error"), message: t("web.state_creation_update_error") });
                } finally {
                  setSavingCreation(false);
                }
              }}
            />
          </span>
        </Tooltip>
      </span>
      {!disabled && (
        <StateDelete
          totalStates={stateCount}
          state={state}
          deleteStateCallback={props.stateOperationsCallbacks.deleteState}
          renderMenu={(deleteAction) => (
            <Menu open={menuOpen} onOpenChange={setMenuOpen}>
              <MenuTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={t("common.actions.edit")}
                    icon={<Icon icon={MoreHorizontalOutline} />}
                  />
                }
              />
              <MenuContent align="end" data-state-actions-menu="" sizing="auto">
                {!state.default && state.allow_new_work_items !== false && !groupClosed && (
                  <MenuItem
                    label={t("web.mark_as_default")}
                    onClick={() => props.stateOperationsCallbacks.markStateAsDefault(state.id).catch(() => undefined)}
                  />
                )}
                <MenuItem
                  label={t("common.actions.edit")}
                  onClick={() => {
                    setUpdateStateModal(true);
                  }}
                />
                <MenuSeparator />
                {deleteAction}
              </MenuContent>
            </Menu>
          )}
        />
      )}
    </div>
  );
});
