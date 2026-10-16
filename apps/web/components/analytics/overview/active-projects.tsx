/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AsyncContent } from "@/components/common/async-content";
import AnalyticsRequestError from "../request-error";

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/blocks/skeleton";
// plane web hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import ActiveProjectItem from "./active-project-item";

const ActiveProjects = observer(function ActiveProjects() {
  const { t } = useTranslation();
  const { fetchProjectAnalyticsCount } = useProject();
  const { workspaceSlug } = useParams();
  const { selectedDurationLabel, selectedDuration, selectedProjects } = useAnalytics();
  const {
    error,
    mutate,
    data: projectAnalyticsCount,
    isLoading: isProjectAnalyticsCountLoading,
  } = useSWR(
    workspaceSlug ? ["projectAnalyticsCount", workspaceSlug, selectedProjects.join(","), selectedDuration] : null,
    workspaceSlug
      ? () =>
          fetchProjectAnalyticsCount(workspaceSlug.toString(), {
            fields: "total_issues,completed_issues,cancelled_issues",
            ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
            ...(selectedProjects.length ? { project_ids: selectedProjects.join(",") } : {}),
          })
      : null
  );
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;

  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.active_projects")}
      subtitle={selectedDurationLabel}
      className="flex h-full flex-col"
      headerClassName="mb-4"
      titleClassName="text-16"
    >
      <AsyncContent
        loading={isProjectAnalyticsCountLoading}
        minHeight={320}
        className="flex-1 [&>div]:h-full"
        skeleton={
          <Loader className="space-y-1">
            {[0, 1, 2, 3].map((key) => (
              <Loader.Item key={key} height="45px" width="100%" />
            ))}
          </Loader>
        }
      >
        <div className="vertical-scrollbar -mx-2 scrollbar-sm h-[320px] space-y-1 overflow-y-auto xl:h-0 xl:min-h-full">
          {!isProjectAnalyticsCountLoading &&
            projectAnalyticsCount?.map((project) => <ActiveProjectItem key={project.id} project={project} />)}
        </div>
      </AsyncContent>
    </AnalyticsSectionWrapper>
  );
});

export default ActiveProjects;
