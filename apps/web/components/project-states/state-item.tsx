/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { observer } from "mobx-react";
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
import { SortableItem } from "@plane/blocks/sortable";
import { cn } from "@plane/utils";
import { STATE_ROW_CLASS_NAME, STATE_ROW_DIVIDER_CLASS_NAME } from "./row-layout";
import { StateItemTitle, StateUpdate } from "@/components/project-states";

type TStateItem = {
  groupKey: TStateGroups;
  groupedStates: Record<string, IState[]>;
  totalStates: number;
  state: IState;
  stateOperationsCallbacks: TStateOperationsCallbacks;
  disabled?: boolean;
  stateItemClassName?: string;
};
export const StateItem = observer(function StateItem({
  groupKey,
  groupedStates,
  totalStates,
  state,
  stateOperationsCallbacks,
  disabled = false,
  stateItemClassName,
}: TStateItem) {
  const [editing, setEditing] = useState(false);
  const [colorPickerInitiallyOpen, setColorPickerInitiallyOpen] = useState(false);
  if (editing) {
    return (
      <div className={cn(STATE_ROW_DIVIDER_CLASS_NAME, stateItemClassName)}>
        <StateUpdate
          colorPickerInitiallyOpen={colorPickerInitiallyOpen}
          state={state}
          updateStateCallback={stateOperationsCallbacks.updateState}
          handleClose={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <SortableItem
      id={state.id}
      index={groupedStates[groupKey].findIndex((item) => item.id === state.id)}
      group={groupKey}
      disabled={{ draggable: disabled || editing || totalStates <= 1, droppable: disabled || editing }}
      className={cn(STATE_ROW_DIVIDER_CLASS_NAME, !editing && STATE_ROW_CLASS_NAME, stateItemClassName)}
    >
      {({ handleRef }) =>
        disabled ? (
          <StateItemTitle
            stateCount={totalStates}
            state={state}
            setUpdateStateModal={(value) => {
              setColorPickerInitiallyOpen(false);
              setEditing(value);
            }}
            onEditColor={() => {
              setColorPickerInitiallyOpen(true);
              setEditing(true);
            }}
            dragHandleRef={handleRef}
            disabled
          />
        ) : (
          <StateItemTitle
            stateCount={totalStates}
            state={state}
            setUpdateStateModal={(value) => {
              setColorPickerInitiallyOpen(false);
              setEditing(value);
            }}
            onEditColor={() => {
              setColorPickerInitiallyOpen(true);
              setEditing(true);
            }}
            disabled={false}
            dragHandleRef={handleRef}
            stateOperationsCallbacks={{
              markStateAsDefault: stateOperationsCallbacks.markStateAsDefault,
              deleteState: stateOperationsCallbacks.deleteState,
            }}
          />
        )
      }
    </SortableItem>
  );
});
