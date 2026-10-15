/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import AnalyticsWrapper from "../analytics-wrapper";
import TotalInsights from "../total-insights";
import ActiveProjects from "./active-projects";
import CreatedVsResolved from "../work-items/created-vs-resolved";
import { AnalyticsDetails } from "../details";

function Overview() {
  return (
    <AnalyticsWrapper i18nTitle="common.overview" className="pt-6">
      <div className="flex flex-col gap-5">
        <TotalInsights analyticsType="overview" />
        <div className="mt-2 grid grid-cols-1 items-stretch gap-8 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-3">
            <CreatedVsResolved dashboard />
          </div>
          <div className="min-w-0 xl:col-span-2">
            <ActiveProjects />
          </div>
        </div>
        <div className="min-w-0 pt-5">
          <AnalyticsDetails tab="projects" embedded />
        </div>
      </div>
    </AnalyticsWrapper>
  );
}
export { Overview };
