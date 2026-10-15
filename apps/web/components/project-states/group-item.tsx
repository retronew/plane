import { StateGroupPanel } from "./group-panel";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useRef } from "react";
import { observer } from "mobx-react";

// plane imports
import { useTranslation } from "@plane/i18n";
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { StateList, StateCreate } from "@/components/project-states";

type TGroupItem = {
  groupKey: TStateGroups;
  groupedStates: Record<string, IState[]>;
  states: IState[];
  stateOperationsCallbacks: TStateOperationsCallbacks;
  isEditable: boolean;
  groupItemClassName?: string;
  stateItemClassName?: string;
};

export const GroupItem = observer(function GroupItem(props: TGroupItem) {
  const {
    groupKey,
    groupedStates,
    states,
    isEditable,
    stateOperationsCallbacks,
    groupItemClassName,
    stateItemClassName,
  } = props;
  // refs
  const dropElementRef = useRef<HTMLDivElement | null>(null);
  // plane hooks
  const { t } = useTranslation();
  // state
  const [createState, setCreateState] = useState(false);
  // derived values
  const shouldShowEmptyState = states.length === 0 && !createState;

  const isCreateDisabled = !isEditable || createState;

  return (
    <div className={cn("min-w-0", groupItemClassName)} ref={dropElementRef}>
      <StateGroupPanel
        title={groupKey}
        addDisabled={isCreateDisabled}
        onAdd={() => {
          setCreateState(true);
        }}
      >
        {shouldShowEmptyState && (
          <div className="flex h-full flex-col items-center justify-center py-4 text-13 text-tertiary">
            <div>{t("project_settings.states.empty_state.title", { groupKey })}</div>
            {isEditable && <div>{t("project_settings.states.empty_state.description")}</div>}
          </div>
        )}

        <div id="group-droppable-container">
          <StateList
            groupKey={groupKey}
            groupedStates={groupedStates}
            states={states}
            disabled={!isEditable}
            stateOperationsCallbacks={stateOperationsCallbacks}
            stateItemClassName={stateItemClassName}
          />
        </div>
        {isEditable && createState && (
          <div>
            <StateCreate
              groupKey={groupKey}
              handleClose={() => setCreateState(false)}
              createStateCallback={stateOperationsCallbacks.createState}
            />
          </div>
        )}
      </StateGroupPanel>
    </div>
  );
});
