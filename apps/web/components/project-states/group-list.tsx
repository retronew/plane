/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { SortableProvider } from "@plane/blocks/sortable";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { getSortedStatePayload } from "./sort-state";
import { observer } from "mobx-react";
// plane imports
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { GroupItem } from "@/components/project-states";

type TGroupList = {
  groupedStates: Record<string, IState[]>;
  stateOperationsCallbacks: TStateOperationsCallbacks;
  isEditable: boolean;
  /** State groups that currently refuse new work items, plus the setter that persists a toggle. */
  disabledStateGroups?: {
    groups: string[];
    onChange: (group: TStateGroups, enabled: boolean) => Promise<void>;
  };
  groupListClassName?: string;
  groupItemClassName?: string;
  stateItemClassName?: string;
};

export const GroupList = observer(function GroupList(props: TGroupList) {
  const {
    groupedStates,
    stateOperationsCallbacks,
    isEditable,
    disabledStateGroups,
    groupListClassName,
    groupItemClassName,
    stateItemClassName,
  } = props;
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  return (
    <div className={cn("rounded-xl border border-subtle bg-layer-2 p-3", groupListClassName)}>
      {Object.entries(groupedStates).map(([key, groupStates]) => {
        const groupKey = key as TStateGroups;
        return (
          <SortableProvider
            key={groupKey}
            disabled={!isEditable || saving}
            onSortEnd={async (change) => {
              const payload = getSortedStatePayload(groupedStates, change);
              if (!payload) return;
              setSaving(true);
              try {
                await stateOperationsCallbacks.moveStatePosition(change.id, payload);
              } catch (error) {
                setToast({ type: "error", title: t("web.category_order_error") });
                throw error;
              } finally {
                setSaving(false);
              }
            }}
          >
            <GroupItem
              groupKey={groupKey}
              states={groupStates}
              groupedStates={groupedStates}
              stateOperationsCallbacks={stateOperationsCallbacks}
              isEditable={isEditable && !saving}
              allowNewWorkItems={
                disabledStateGroups
                  ? {
                      checked: !disabledStateGroups.groups.includes(groupKey),
                      onChange: (checked) => disabledStateGroups.onChange(groupKey, checked),
                    }
                  : undefined
              }
              groupItemClassName={groupItemClassName}
              stateItemClassName={stateItemClassName}
            />
          </SortableProvider>
        );
      })}
    </div>
  );
});
