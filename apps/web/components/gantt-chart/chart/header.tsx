/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
import { observer } from "mobx-react";
import { ArrowCollapseOutline, FullScreenOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
// plane
import type { TGanttViews } from "@plane/types";
import { Row } from "@plane/blocks/layout";
// components
import { Tabs, TabsList, Tab } from "@makeplane/propel/components/tabs";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Button } from "@makeplane/propel/components/button";
import { VIEWS_LIST } from "@/components/gantt-chart/data";
// helpers
// hooks
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
//
import { GANTT_BREADCRUMBS_HEIGHT } from "../constants";

type Props = {
  blockIds: string[];
  fullScreenMode: boolean;
  handleChartView: (view: TGanttViews) => void;
  handleToday: () => void;
  loaderTitle: string;
  toggleFullScreenMode: () => void;
  showToday: boolean;
};

export const GanttChartHeader = observer(function GanttChartHeader(props: Props) {
  const { t } = useTranslation();
  const { blockIds, fullScreenMode, handleChartView, handleToday, loaderTitle, toggleFullScreenMode, showToday } =
    props;
  // chart hook
  const { currentView } = useTimeLineChartStore();

  return (
    <Row
      className="relative flex w-full flex-shrink-0 flex-nowrap items-center gap-2 bg-surface-1 py-2 whitespace-nowrap"
      style={{ height: `${GANTT_BREADCRUMBS_HEIGHT}px` }}
    >
      <div className="ml-auto">
        <div className="ml-auto text-13 text-secondary">
          {blockIds
            ? translate("web.ui.gantt_item_count", { count: blockIds.length, type: loaderTitle })
            : t("common.loading")}
        </div>
      </div>

      <div className="w-fit shrink-0">
        <Tabs
          variant="contained"
          value={currentView}
          onValueChange={(value) => {
            if (value === "week" || value === "month" || value === "quarter") handleChartView(value);
          }}
        >
          <TabsList>
            {VIEWS_LIST.map((view) => (
              <Tab key={view.key} value={view.key} label={t(view.i18n_title)} />
            ))}
          </TabsList>
        </Tabs>
      </div>

      {showToday && <Button variant="ghost" size="sm" stretch="auto" label={t("common.today")} onClick={handleToday} />}
      <IconButton
        variant="secondary"
        size="md"
        aria-label={t("common.full_screen")}
        aria-pressed={fullScreenMode}
        icon={fullScreenMode ? <ArrowCollapseOutline className="size-4" /> : <FullScreenOutline className="size-4" />}
        onClick={toggleFullScreenMode}
      />
    </Row>
  );
});
