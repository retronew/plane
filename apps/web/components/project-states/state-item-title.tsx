import { StateSummary } from "./state-summary";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type SetStateAction } from "react";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { DragDropOutline, EditOutline } from "@makeplane/propel/icons";
// plane imports
import { StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateOperationsCallbacks } from "@plane/types";
// local imports
import { useProjectState } from "@/hooks/store/use-project-state";
import { StateDelete, StateMarksAsDefault } from "./options";

type TBaseStateItemTitleProps = {
  stateCount: number;
  onEditColor?: () => void;
  dragHandleRef?: (element: Element | null) => void;
  state: IState;
  shouldShowDescription?: boolean;
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
  } = props;
  // plane hooks
  const { t } = useTranslation();
  const [savingCreation, setSavingCreation] = useState(false);
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
            <StateGroupIcon stateGroup={state.group} color={state.color} size={EIconSize.XL} percentage={percentage} />
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
      <label className="flex shrink-0 items-center gap-2 text-12 text-tertiary">
        {t("web.allow_new_work_items")}
        <Switch
          size="sm"
          checked={state.allow_new_work_items !== false}
          disabled={disabled || savingCreation}
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
      </label>
      {!disabled && (
        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {/* state mark as default option */}
          {!state.default && state.allow_new_work_items !== false && (
            <div className="flex-shrink-0 text-11 transition-all">
              <StateMarksAsDefault
                stateId={state.id}
                isDefault={Boolean(state.default)}
                markStateAsDefaultCallback={props.stateOperationsCallbacks.markStateAsDefault}
              />
            </div>
          )}
          {/* state edit options */}
          <div className="flex items-center gap-1 transition-all">
            <IconButton
              type="button"
              variant="ghost"
              size="xs"
              aria-label={t("common.actions.edit")}
              onClick={(event) => {
                if (onEditColor && event.target instanceof Element && event.target.closest("[data-state-color-target]"))
                  onEditColor();
                else setUpdateStateModal(true);
              }}
              icon={<Icon icon={EditOutline} />}
            />
            <StateDelete
              totalStates={stateCount}
              state={state}
              deleteStateCallback={props.stateOperationsCallbacks.deleteState}
            />
          </div>
        </div>
      )}
    </div>
  );
});
