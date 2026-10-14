import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { observer } from "mobx-react";
// ui
import type { ISvgIcons } from "@plane/blocks/icons";
import { GridOutline, ListOutline, TimelineOutline } from "@makeplane/propel/icons";
// plane package imports
import type { TCycleLayoutOptions } from "@plane/types";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
// hooks
import { useCycleFilter } from "@/hooks/store/use-cycle-filter";
import { useProject } from "@/hooks/store/use-project";
import { translate } from "@plane/i18n";

const CYCLE_VIEW_LAYOUTS: {
  key: TCycleLayoutOptions;
  icon: React.FC<ISvgIcons>;
  title: string;
}[] = [
  {
    key: "list",
    icon: ListOutline,
    get title() {
      return translate("web.list_layout");
    },
  },
  {
    key: "board",
    icon: GridOutline,
    get title() {
      return translate("web.gallery_layout");
    },
  },
  {
    key: "gantt",
    icon: TimelineOutline,
    get title() {
      return translate("web.timeline_layout");
    },
  },
];

export const CyclesListMobileHeader = observer(function CyclesListMobileHeader() {
  const { currentProjectDetails } = useProject();
  // hooks
  const { updateDisplayFilters } = useCycleFilter();
  return (
    <div className="flex justify-center sm:hidden">
      <Menu>
        <div className="flex flex-grow justify-center border-b border-subtle bg-surface-1 py-2 text-13 text-secondary">
          <MenuTrigger
            render={
              <button
                aria-label={translate("common.layout")}
                type="button"
                className="flex flex-grow items-center justify-center text-13 text-secondary"
              />
            }
          >
            <span className="flex items-center gap-2">
              <ListOutline className="h-4 w-4" />
              <span className="flex flex-grow justify-center text-13 text-secondary">{translate("web.layout")}</span>
            </span>
          </MenuTrigger>
        </div>
        <MenuContent side="bottom" align="start">
          {CYCLE_VIEW_LAYOUTS.map((layout) => {
            if (layout.key == "gantt") return null;
            return (
              <MenuItem
                key={layout.key}
                label={layout.title}
                icon={<Icon icon={<layout.icon className="size-3" />} />}
                onClick={() => {
                  updateDisplayFilters(currentProjectDetails!.id, {
                    layout: layout.key,
                  });
                }}
              />
            );
          })}
        </MenuContent>
      </Menu>
    </div>
  );
});
