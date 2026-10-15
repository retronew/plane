/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane web components
import { observer } from "mobx-react";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
// components
import DurationDropdown from "./select/duration";
import { ProjectSelect } from "./select/project";

const AnalyticsFilterActions = observer(function AnalyticsFilterActions() {
  const { selectedProjects, updateSelectedProjects, selectedDuration, updateSelectedDuration } = useAnalytics();
  const { joinedProjectIds } = useProject();
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <ProjectSelect
        value={selectedProjects}
        onChange={(val) => {
          updateSelectedProjects(val ?? []);
        }}
        projectIds={joinedProjectIds}
      />
      <DurationDropdown value={selectedDuration} onChange={updateSelectedDuration} />
    </div>
  );
});

export default AnalyticsFilterActions;
