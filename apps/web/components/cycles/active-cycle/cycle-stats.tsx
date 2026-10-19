/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useRef, useState } from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { useTheme } from "next-themes";
import { CompletedAtOutline } from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { useTranslation, translate } from "@plane/i18n";
import { PriorityIcon } from "@plane/blocks/icons";
import { Tabs, TabsList, Tab, TabsPanel } from "@makeplane/propel/components/tabs";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import type {
  ICycle,
  TCycleAssigneesDistribution,
  TCycleDistribution,
  TCycleDistributionBase,
  TCycleLabelsDistribution,
  TIssue,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
// ui
import { Loader } from "@plane/blocks/skeleton";
import { renderFormattedDate, renderFormattedDateWithoutYear, getFileURL } from "@plane/utils";
// assets
import darkAssigneeAsset from "@/app/assets/empty-state/active-cycle/assignee-dark.webp?url";
import lightAssigneeAsset from "@/app/assets/empty-state/active-cycle/assignee-light.webp?url";
import darkLabelAsset from "@/app/assets/empty-state/active-cycle/label-dark.webp?url";
import lightLabelAsset from "@/app/assets/empty-state/active-cycle/label-light.webp?url";
import darkPriorityAsset from "@/app/assets/empty-state/active-cycle/priority-dark.webp?url";
import lightPriorityAsset from "@/app/assets/empty-state/active-cycle/priority-light.webp?url";
import userImage from "@/app/assets/user.png?url";
// components
import { SingleProgressStats } from "@/components/core/sidebar/single-progress-stats";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { SimpleEmptyState } from "@/components/empty-state/simple-empty-state-root";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import useLocalStorage from "@/hooks/use-local-storage";
// store
import type { ActiveCycleIssueDetails } from "@/store/issue/cycle";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";

export type ActiveCycleStatsProps = {
  workspaceSlug: string;
  projectId: string;
  cycle: ICycle | null;
  cycleId?: string | null;
  handleFiltersUpdate: (conditions: TWorkItemFilterCondition[]) => void;
  cycleIssueDetails?: ActiveCycleIssueDetails | { nextPageResults: boolean };
};

type TPriorityIssueRowProps = {
  issue: TIssue;
  projectId: string;
  workspaceSlug: string;
  setPeekIssue: (peekIssue: TPeekIssue) => void;
  handleFiltersUpdate: ActiveCycleStatsProps["handleFiltersUpdate"];
};

type TPriorityIssuesPanelProps = {
  cycleIssueDetails: ActiveCycleStatsProps["cycleIssueDetails"];
  getIssueById: (issueId: string) => TIssue | undefined;
  projectId: string;
  setIssueLoaderElement: (element: HTMLDivElement | null) => void;
  setPeekIssue: (peekIssue: TPeekIssue) => void;
  handleFiltersUpdate: ActiveCycleStatsProps["handleFiltersUpdate"];
  workspaceSlug: string;
};

type TAssigneeStatsProps = {
  assignee: TCycleAssigneesDistribution & TCycleDistributionBase;
  handleFiltersUpdate: ActiveCycleStatsProps["handleFiltersUpdate"];
};

type TUnassignedAssigneeStatsProps = {
  assignee: TCycleAssigneesDistribution & TCycleDistributionBase;
};

type TLabelStatsRowProps = {
  label: TCycleLabelsDistribution & TCycleDistributionBase;
  handleFiltersUpdate: ActiveCycleStatsProps["handleFiltersUpdate"];
};

type TDistributionPanelProps = {
  cycle: ICycle | null;
  handleFiltersUpdate: ActiveCycleStatsProps["handleFiltersUpdate"];
};

const getCycleDistribution = (cycle: ICycle | null): TCycleDistribution | null => {
  if (!cycle || isEmpty(cycle.distribution)) return null;
  return cycle.distribution ?? null;
};

function ActiveCycleLoaders() {
  return (
    <Loader className="space-y-3">
      <Loader.Item height="30px" />
      <Loader.Item height="30px" />
      <Loader.Item height="30px" />
    </Loader>
  );
}

function CycleStatsEmptyState({ title, assetPath }: { title: string; assetPath: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <SimpleEmptyState title={title} assetPath={assetPath} />
    </div>
  );
}

function PriorityIssueRow(props: TPriorityIssueRowProps) {
  const { issue, projectId, workspaceSlug, setPeekIssue, handleFiltersUpdate } = props;

  const handleOpenIssue = () => {
    if (!issue.id) return;
    setPeekIssue({
      workspaceSlug,
      projectId,
      issueId: issue.id,
      isArchived: !!issue.archived_at,
    });
    handleFiltersUpdate([{ property: "priority", operator: "in", value: ["urgent", "high"] }]);
  };

  return (
    <div className="group flex items-center justify-between gap-2 rounded-md p-1 hover:bg-surface-2">
      <IssueIdentifier issueId={issue.id} projectId={projectId} size="xs" variant="secondary" />
      <button
        type="button"
        className="focus-visible:outline-primary flex min-w-0 flex-1 items-center justify-between gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={handleOpenIssue}
      >
        <div className="flex w-full min-w-24 flex-grow items-center gap-1.5 truncate">
          <Tooltip label={translate("web.runtime.title_value", { name: issue.name })} layout="stacked" align="start">
            <span className="truncate text-13 text-primary">{issue.name}</span>
          </Tooltip>
        </div>
        <PriorityIcon priority={issue.priority} />
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {issue.target_date && (
            <Tooltip
              label={translate("web.runtime.target_date", {
                date: renderFormattedDate(issue.target_date) ?? "",
              })}
            >
              <div className="flex h-full cursor-pointer items-center gap-1.5 truncate rounded-sm bg-layer-1 px-2 py-0.5 text-11 group-hover:bg-surface-1">
                <CompletedAtOutline className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-11">{renderFormattedDateWithoutYear(issue.target_date)}</span>
              </div>
            </Tooltip>
          )}
        </div>
      </button>
      <StateSelect
        issueTypeId={issue.type_id}
        value={issue.state_id}
        onChange={() => {}}
        projectId={projectId?.toString() ?? ""}
        disabled
        variant="pill-sm"
        className="max-w-24"
        tooltip
      />
    </div>
  );
}

const PriorityIssuesPanel = observer(function PriorityIssuesPanel(props: TPriorityIssuesPanelProps) {
  const {
    cycleIssueDetails,
    getIssueById,
    projectId,
    setIssueLoaderElement,
    setPeekIssue,
    handleFiltersUpdate,
    workspaceSlug,
  } = props;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const priorityResolvedPath = resolvedTheme === "light" ? lightPriorityAsset : darkPriorityAsset;

  if (!cycleIssueDetails || !("issueIds" in cycleIssueDetails)) return <ActiveCycleLoaders />;

  if (!(cycleIssueDetails.issueCount > 0)) {
    return (
      <CycleStatsEmptyState
        title={t("active_cycle.empty_state.priority_issue.title")}
        assetPath={priorityResolvedPath}
      />
    );
  }

  return (
    <>
      {cycleIssueDetails.issueIds.map((issueId: string) => {
        const issue = getIssueById(issueId);

        if (!issue) return null;

        return (
          <PriorityIssueRow
            key={issue.id}
            issue={issue}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            setPeekIssue={setPeekIssue}
            handleFiltersUpdate={handleFiltersUpdate}
          />
        );
      })}
      {cycleIssueDetails.nextPageResults !== false && (
        <div
          ref={setIssueLoaderElement}
          className={"relative flex h-11 animate-pulse cursor-pointer items-center gap-3 bg-layer-1 p-3 text-13"}
        />
      )}
    </>
  );
});

function AssigneeStats(props: TAssigneeStatsProps) {
  const { assignee, handleFiltersUpdate } = props;

  const handleClick = () => {
    if (!assignee.assignee_id) return;
    handleFiltersUpdate([{ property: "assignee_id", operator: "in", value: [assignee.assignee_id] }]);
  };

  return (
    <SingleProgressStats
      title={
        <div className="flex items-center gap-2">
          <Avatar
            alt={assignee?.display_name ?? undefined}
            fallback={assignee?.display_name?.[0]?.toUpperCase()}
            src={getFileURL(assignee?.avatar_url ?? "")}
            size="xs"
          />

          <span>{assignee.display_name}</span>
        </div>
      }
      completed={assignee.completed_issues}
      total={assignee.total_issues}
      onClick={handleClick}
    />
  );
}

function UnassignedAssigneeStats(props: TUnassignedAssigneeStatsProps) {
  const { assignee } = props;
  // plane hooks
  const { t } = useTranslation();

  return (
    <SingleProgressStats
      title={
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-subtle bg-layer-1">
            <img src={userImage} height="100%" width="100%" className="rounded-full" alt={t("web.user")} />
          </div>
          <span>{t("no_assignee")}</span>
        </div>
      }
      completed={assignee.completed_issues}
      total={assignee.total_issues}
    />
  );
}

const AssigneesPanel = observer(function AssigneesPanel(props: TDistributionPanelProps) {
  const { cycle, handleFiltersUpdate } = props;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const assigneesResolvedPath = resolvedTheme === "light" ? lightAssigneeAsset : darkAssigneeAsset;
  const distribution = getCycleDistribution(cycle);

  if (!distribution) return <ActiveCycleLoaders />;

  const assignees = distribution.assignees;
  if (!assignees || assignees.length === 0) {
    return (
      <CycleStatsEmptyState title={t("active_cycle.empty_state.assignee.title")} assetPath={assigneesResolvedPath} />
    );
  }

  return (
    <>
      {assignees.map((assignee) =>
        assignee.assignee_id ? (
          <AssigneeStats key={assignee.assignee_id} assignee={assignee} handleFiltersUpdate={handleFiltersUpdate} />
        ) : (
          <UnassignedAssigneeStats key="unassigned" assignee={assignee} />
        )
      )}
    </>
  );
});

function LabelStatsRow(props: TLabelStatsRowProps) {
  const { label, handleFiltersUpdate } = props;
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const labelId = label.label_id;

  return (
    <SingleProgressStats
      title={
        <div className="flex items-center gap-2 truncate">
          <span
            className="block h-3 w-3 flex-shrink-0 rounded-full"
            style={{
              backgroundColor: label.color ?? "#000000",
            }}
          />
          <span className="truncate text-11 text-ellipsis">{label.label_name ?? t("web.no_labels_2")}</span>
        </div>
      }
      completed={label.completed_issues}
      total={label.total_issues}
      onClick={
        labelId ? () => handleFiltersUpdate([{ property: "label_id", operator: "in", value: [labelId] }]) : undefined
      }
    />
  );
}

const LabelsPanel = observer(function LabelsPanel(props: TDistributionPanelProps) {
  const { cycle, handleFiltersUpdate } = props;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const labelsResolvedPath = resolvedTheme === "light" ? lightLabelAsset : darkLabelAsset;
  const distribution = getCycleDistribution(cycle);

  if (!distribution) return <ActiveCycleLoaders />;

  const labels = distribution.labels;
  if (!labels || labels.length === 0) {
    return <CycleStatsEmptyState title={t("active_cycle.empty_state.label.title")} assetPath={labelsResolvedPath} />;
  }

  return (
    <>
      {labels.map((label) => (
        <LabelStatsRow key={label.label_id ?? "no-label"} label={label} handleFiltersUpdate={handleFiltersUpdate} />
      ))}
    </>
  );
});

export const ActiveCycleStats = observer(function ActiveCycleStats(props: ActiveCycleStatsProps) {
  const { workspaceSlug, projectId, cycle, cycleId, handleFiltersUpdate, cycleIssueDetails } = props;
  // local storage
  const { storedValue: tab, setValue: setTab } = useLocalStorage("activeCycleTab", "Assignees");
  // refs
  const issuesContainerRef = useRef<HTMLDivElement | null>(null);
  // states
  const [issuesLoaderElement, setIssueLoaderElement] = useState<HTMLDivElement | null>(null);
  // plane hooks
  const { t } = useTranslation();

  const {
    issues: { fetchNextActiveCycleIssues },
  } = useIssues(EIssuesStoreType.CYCLE);
  const {
    issue: { getIssueById },
    setPeekIssue,
  } = useIssueDetail();
  const loadMoreIssues = useCallback(() => {
    if (!cycleId) return;
    fetchNextActiveCycleIssues(workspaceSlug, projectId, cycleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, cycleId, issuesLoaderElement, cycleIssueDetails?.nextPageResults]);

  useIntersectionObserver(issuesContainerRef, issuesLoaderElement, loadMoreIssues, `0% 0% 100% 0%`);

  return cycleId ? (
    <div className="col-span-1 flex min-h-[17rem] flex-col gap-4 overflow-hidden rounded-lg border border-subtle bg-surface-1 p-4 lg:col-span-2 xl:col-span-1">
      <Tabs
        variant="contained"
        stretch="full"
        defaultValue={tab ?? "Priority-Issues"}
        onValueChange={(value: string) => setTab(value)}
      >
        <TabsList>
          <Tab value="Priority-Issues" label={t("project_cycles.active_cycle.priority_issue")} />
          <Tab value="Assignees" label={t("project_cycles.active_cycle.assignees")} />
          <Tab value="Labels" label={t("project_cycles.active_cycle.labels")} />
        </TabsList>

        <TabsPanel value="Priority-Issues">
          <div className="vertical-scrollbar scrollbar-sm flex h-52 w-full flex-col gap-1 overflow-y-auto text-secondary">
            <div
              ref={issuesContainerRef}
              className="vertical-scrollbar scrollbar-sm flex h-full w-full flex-col gap-1 overflow-y-auto"
            >
              <PriorityIssuesPanel
                cycleIssueDetails={cycleIssueDetails}
                getIssueById={getIssueById}
                projectId={projectId}
                setIssueLoaderElement={setIssueLoaderElement}
                setPeekIssue={setPeekIssue}
                handleFiltersUpdate={handleFiltersUpdate}
                workspaceSlug={workspaceSlug}
              />
            </div>
          </div>
        </TabsPanel>

        <TabsPanel value="Assignees">
          <div className="vertical-scrollbar scrollbar-sm flex h-52 w-full flex-col gap-1 overflow-y-auto text-secondary">
            <AssigneesPanel cycle={cycle} handleFiltersUpdate={handleFiltersUpdate} />
          </div>
        </TabsPanel>

        <TabsPanel value="Labels">
          <div className="vertical-scrollbar scrollbar-sm flex h-52 w-full flex-col gap-1 overflow-y-auto text-secondary">
            <LabelsPanel cycle={cycle} handleFiltersUpdate={handleFiltersUpdate} />
          </div>
        </TabsPanel>
      </Tabs>
    </div>
  ) : (
    <Loader className="col-span-1 flex min-h-[17rem] flex-col gap-4 overflow-hidden bg-surface-1 lg:col-span-2 xl:col-span-1">
      <Loader.Item width="100%" height="17rem" />
    </Loader>
  );
});
