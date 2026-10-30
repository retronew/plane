/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
// components
import { StateItem } from "@/components/project-states";

type TStateList = {
  groupKey: TStateGroups;
  groupedStates: Record<string, IState[]>;
  states: IState[];
  stateOperationsCallbacks: TStateOperationsCallbacks;
  disabled?: boolean;
  /** The group's own switch is off, so none of its states can accept new work items. */
  groupClosed?: boolean;
  stateItemClassName?: string;
};

export const StateList = observer(function StateList(props: TStateList) {
  const {
    groupKey,
    groupedStates,
    states,
    stateOperationsCallbacks,
    disabled = false,
    groupClosed = false,
    stateItemClassName,
  } = props;

  return (
    <>
      {states.map((state: IState) => (
        <StateItem
          key={state?.name}
          groupKey={groupKey}
          groupedStates={groupedStates}
          totalStates={states.length || 0}
          state={state}
          disabled={disabled}
          groupClosed={groupClosed}
          stateOperationsCallbacks={stateOperationsCallbacks}
          stateItemClassName={stateItemClassName}
        />
      ))}
    </>
  );
});
