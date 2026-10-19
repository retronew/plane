/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps, ReactNode, SyntheticEvent } from "react";
import { useCallback, useMemo } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { AttachOutline, DueDateOutline, LinkOutline, StartDateOutline, ViewsOutline } from "@makeplane/propel/icons";
// i18n
import { useTranslation, translate } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { DateRangeValue } from "@plane/blocks/property-select";
import { DateRangeSelect, DateSelect } from "@plane/blocks/property-select";
import type { TIssue, IIssueDisplayProperties, TIssuePriorities } from "@plane/types";
// ui
import {
  cn,
  formatCompactDate,
  formatCompactDateRange,
  getDate,
  renderFormattedPayloadDate,
  generateWorkItemLink,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
// components
import { CycleSelect } from "@/components/dropdowns/cycle/cycle-select";
import { EstimateSelect } from "@/components/dropdowns/estimate/estimate-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ModuleSelect } from "@/components/dropdowns/module/module-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserProfile } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import { IssuePropertyLabels } from "./labels";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import { ListPropertiesOverflow } from "./list-properties-overflow";

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
}

type IssueOperations = {
  addModulesToIssue: (moduleIds: string[]) => Promise<void>;
  removeModulesFromIssue: (moduleIds: string[]) => Promise<void>;
  addIssueToCycle: (cycleId: string) => Promise<void>;
  removeIssueFromCycle: () => Promise<void>;
};

type IssueOperationTarget = { workspaceSlug: string; projectId: string; issueId: string } | null;

function getIssueOperationTarget(workspaceSlug: string | undefined, issue: TIssue): IssueOperationTarget {
  if (!workspaceSlug || !issue.project_id || !issue.id) return null;
  return { workspaceSlug: workspaceSlug.toString(), projectId: issue.project_id, issueId: issue.id };
}

function getModuleChanges(currentModuleIds: string[], moduleIds: string[]) {
  const currentSet = new Set(currentModuleIds);
  const modulesToAdd: string[] = [];
  const modulesToRemove: string[] = [];
  for (const moduleId of xor(currentModuleIds, moduleIds)) {
    if (currentSet.has(moduleId)) modulesToRemove.push(moduleId);
    else modulesToAdd.push(moduleId);
  }
  return { modulesToAdd, modulesToRemove };
}

function applyModuleChanges(
  changes: { modulesToAdd: string[]; modulesToRemove: string[] },
  operations: IssueOperations
) {
  if (changes.modulesToAdd.length > 0) void operations.addModulesToIssue(changes.modulesToAdd);
  if (changes.modulesToRemove.length > 0) void operations.removeModulesFromIssue(changes.modulesToRemove);
}

function applyCycleChange(cycleId: string | null, issue: TIssue, operations: IssueOperations) {
  if (issue.cycle_id === cycleId) return;
  if (cycleId) void operations.addIssueToCycle(cycleId);
  else void operations.removeIssueFromCycle();
}

function getIsDateRangeEnabled(issue: TIssue, displayProperties: IIssueDisplayProperties) {
  return Boolean(issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date);
}

function getDefaultLabelOptions<T>(labelIds: string[] | undefined, labelMap: Record<string, T>) {
  return (
    labelIds?.flatMap((id) => {
      const label = labelMap[id];
      return label ? [label] : [];
    }) ?? []
  );
}

function getLayoutMetrics(activeLayout: string) {
  const isKanban = activeLayout === "Kanban";
  return {
    pillVariant: isKanban ? ("pill-md" as const) : ("pill-sm" as const),
    avatarVariant: isKanban ? ("avatar-group-md" as const) : ("avatar-group-sm" as const),
    propertyHeight: isKanban ? "h-6" : "h-5",
  };
}

type UpdateIssueFn = NonNullable<IIssueProperties["updateIssue"]>;

function createUpdateHandlers(issue: TIssue, updateIssue: UpdateIssueFn | undefined) {
  const update = async (data: Partial<TIssue>) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, data);
  };
  return {
    handleState: (stateId: string) => void update({ state_id: stateId }),
    handlePriority: (value: TIssuePriorities) => void update({ priority: value }),
    handleLabel: (ids: string[]) => void update({ label_ids: ids }),
    handleAssignee: (ids: string[]) => void update({ assignee_ids: ids }),
    handleStartDate: (date: Date | null) => void update({ start_date: date ? renderFormattedPayloadDate(date) : null }),
    handleTargetDate: (date: Date | null) =>
      void update({ target_date: date ? renderFormattedPayloadDate(date) : null }),
    handleDateRangeUpdate: (range: DateRangeValue) =>
      void update({
        start_date: range.from ? renderFormattedPayloadDate(range.from) : null,
        target_date: range.to ? renderFormattedPayloadDate(range.to) : null,
      }),
    handleEstimate: (value: string | null) => void update({ estimate_point: value }),
  };
}

function createIssueOperations(
  target: IssueOperationTarget,
  actions: {
    changeModulesInIssue?: (
      workspaceSlug: string,
      projectId: string,
      issueId: string,
      add: string[],
      remove: string[]
    ) => Promise<unknown>;
    addCycleToIssue?: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<unknown>;
    removeCycleFromIssue?: (workspaceSlug: string, projectId: string, issueId: string) => Promise<unknown>;
  }
): IssueOperations {
  return {
    addModulesToIssue: async (moduleIds) => {
      if (!target) return;
      await actions.changeModulesInIssue?.(target.workspaceSlug, target.projectId, target.issueId, moduleIds, []);
    },
    removeModulesFromIssue: async (moduleIds) => {
      if (!target) return;
      await actions.changeModulesInIssue?.(target.workspaceSlug, target.projectId, target.issueId, [], moduleIds);
    },
    addIssueToCycle: async (cycleId) => {
      if (!target) return;
      await actions.addCycleToIssue?.(target.workspaceSlug, target.projectId, cycleId, target.issueId);
    },
    removeIssueFromCycle: async () => {
      if (!target) return;
      await actions.removeCycleFromIssue?.(target.workspaceSlug, target.projectId, target.issueId);
    },
  };
}

function SubIssuesProperty({
  displayProperties,
  subIssueCount,
  isMobile,
  onOpen,
}: {
  displayProperties: IIssueDisplayProperties;
  subIssueCount: number;
  isMobile: boolean;
  onOpen: () => void;
}) {
  const label = translate("web.runtime.sub_items_count", { count: subIssueCount ?? 0 });

  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey="sub_issue_count"
      shouldRenderProperty={(properties) => !!properties.sub_issue_count && !!subIssueCount}
    >
      <Tooltip label={label} disabled={isMobile}>
        <button
          type="button"
          aria-label={label}
          onFocus={(event) => event.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (subIssueCount) onOpen();
          }}
          className={cn(
            "flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1",
            {
              "cursor-pointer hover:bg-layer-1": subIssueCount,
            }
          )}
        >
          <ViewsOutline className="h-3 w-3 flex-shrink-0" />
          <div className="text-caption-sm-regular">{subIssueCount}</div>
        </button>
      </Tooltip>
    </WithDisplayPropertiesHOC>
  );
}

function CountBadgeProperty({
  displayProperties,
  displayPropertyKey,
  count,
  label,
  icon,
  isMobile,
  onEvent,
}: {
  displayProperties: IIssueDisplayProperties;
  displayPropertyKey: keyof IIssueDisplayProperties;
  count: number | undefined;
  label: string;
  icon: ReactNode;
  isMobile: boolean;
  onEvent: (event: SyntheticEvent<HTMLDivElement>) => void;
}) {
  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey={displayPropertyKey}
      shouldRenderProperty={(properties) => Boolean(properties[displayPropertyKey]) && Boolean(count)}
    >
      <Tooltip label={label} disabled={isMobile}>
        {/* oxlint-disable jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions */}
        <div
          role="presentation"
          className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1"
          onFocus={onEvent}
          onClick={onEvent}
          onKeyDown={onEvent}
        >
          {icon}
          <div className="text-caption-sm-regular">{count}</div>
        </div>
        {/* oxlint-enable jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions */}
      </Tooltip>
    </WithDisplayPropertiesHOC>
  );
}

type ProjectDetails = ReturnType<ReturnType<typeof useProject>["getProjectById"]>;
type StateDetails = ReturnType<ReturnType<typeof useProjectState>["getStateById"]>;
type Translate = ReturnType<typeof useTranslation>["t"];

function getSubIssueCount(issue: TIssue) {
  return issue.sub_issues_count ?? 0;
}

function getAssigneeVariant(
  count: number | undefined,
  avatarVariant: "avatar-group-md" | "avatar-group-sm",
  pillVariant: "pill-md" | "pill-sm"
) {
  return count ? avatarVariant : pillVariant;
}

function isEstimateVisible(projectId: string | undefined, isEnabled: (id: string) => boolean) {
  return Boolean(projectId && isEnabled(projectId.toString()));
}

function getWorkItemLink(workspaceSlug: string | undefined, issue: TIssue, projectDetails: ProjectDetails) {
  return generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue.project_id,
    issueId: issue.id,
    projectIdentifier: projectDetails?.identifier,
    sequenceId: issue.sequence_id,
    isArchived: !!issue.archived_at,
  });
}

function IssueDateProperties({
  issue,
  displayProperties,
  isDateRangeEnabled,
  activeLayout,
  pillVariant,
  propertyHeight,
  isReadOnly,
  weekStartsOn,
  stateDetails,
  onEvent,
  onChangeRange,
  onChangeStart,
  onChangeDue,
  t,
}: {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties;
  isDateRangeEnabled: boolean;
  activeLayout: string;
  pillVariant: "pill-md" | "pill-sm";
  propertyHeight: string;
  isReadOnly: boolean;
  weekStartsOn: ComponentProps<typeof DateRangeSelect>["weekStartsOn"];
  stateDetails: StateDetails;
  onEvent: (event: SyntheticEvent<HTMLDivElement>) => void;
  onChangeRange: (range: DateRangeValue) => void;
  onChangeStart: (date: Date | null) => void;
  onChangeDue: (date: Date | null) => void;
  t: Translate;
}) {
  const rangeLabelFormat = activeLayout === "List" ? formatCompactDateRange : undefined;
  const dateLabelFormat = activeLayout === "List" ? formatCompactDate : undefined;
  const highlightDueDateClassName = shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group)
    ? { "text-danger-primary": true }
    : undefined;
  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  return (
    <>
      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
          <DateRangeSelect
            value={{
              from: getDate(issue.start_date) ?? null,
              to: getDate(issue.target_date) ?? null,
            }}
            onChange={onChangeRange}
            icon={<StartDateOutline />}
            clearable
            mergeDates
            formatLabel={rangeLabelFormat}
            className={cn(highlightDueDateClassName)}
            disabled={isReadOnly}
            showTooltip
            tooltipHeading={t("project_cycles.date_range")}
            weekStartsOn={weekStartsOn}
            variant={pillVariant}
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
          <DateSelect
            value={getDate(issue.start_date) ?? null}
            onChange={onChangeStart}
            formatLabel={dateLabelFormat}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDateOutline />}
            clearable
            disabled={isReadOnly}
            showTooltip
            tooltipHeading={t("common.order_by.start_date")}
            weekStartsOn={weekStartsOn}
            variant={pillVariant}
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
          <DateSelect
            value={getDate(issue.target_date) ?? null}
            onChange={onChangeDue}
            formatLabel={dateLabelFormat}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDateOutline />}
            className={cn(highlightDueDateClassName)}
            clearable
            disabled={isReadOnly}
            showTooltip
            tooltipHeading={t("common.order_by.due_date")}
            weekStartsOn={weekStartsOn}
            variant={pillVariant}
          />
        </div>
      </WithDisplayPropertiesHOC>
    </>
  );
}

function ProjectRelationProperties({
  issue,
  projectDetails,
  displayProperties,
  propertyHeight,
  pillVariant,
  isReadOnly,
  onModuleChange,
  onCycleChange,
  onEvent,
}: {
  issue: TIssue;
  projectDetails: ProjectDetails;
  displayProperties: IIssueDisplayProperties;
  propertyHeight: string;
  pillVariant: "pill-md" | "pill-sm";
  isReadOnly: boolean;
  onModuleChange: (moduleIds: string[] | null) => void;
  onCycleChange: (cycleId: string | null) => void;
  onEvent: (event: SyntheticEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      {/* modules */}
      {projectDetails?.module_view && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="modules">
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
            <ModuleSelect
              multiple
              projectId={issue.project_id ?? undefined}
              value={issue.module_ids ?? []}
              onChange={onModuleChange}
              disabled={isReadOnly}
              variant={pillVariant}
              tooltip
            />
          </div>
        </WithDisplayPropertiesHOC>
      )}

      {/* cycles */}
      {projectDetails?.cycle_view && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="cycle">
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
            <CycleSelect
              projectId={issue.project_id ?? undefined}
              value={issue.cycle_id}
              onChange={onCycleChange}
              disabled={isReadOnly}
              variant={pillVariant}
              tooltip
            />
          </div>
        </WithDisplayPropertiesHOC>
      )}
    </>
  );
}

function EstimateProperty({
  show,
  issue,
  projectId,
  displayProperties,
  propertyHeight,
  pillVariant,
  isReadOnly,
  onEvent,
  onChange,
}: {
  show: boolean;
  issue: TIssue;
  projectId: string;
  displayProperties: IIssueDisplayProperties;
  propertyHeight: string;
  pillVariant: "pill-md" | "pill-sm";
  isReadOnly: boolean;
  onEvent: (event: SyntheticEvent<HTMLDivElement>) => void;
  onChange: (value: string | null) => void;
}) {
  if (!show) return null;

  return (
    <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
      <div role="presentation" className={propertyHeight} onFocus={onEvent} onClick={onEvent} onKeyDown={onEvent}>
        <EstimateSelect
          value={issue.estimate_point ?? undefined}
          onChange={onChange}
          projectId={projectId}
          disabled={isReadOnly}
          variant={pillVariant}
          tooltip
        />
      </div>
    </WithDisplayPropertiesHOC>
  );
}

export const IssueProperties = observer(function IssueProperties(props: IIssueProperties) {
  const { issue, updateIssue, displayProperties, isReadOnly, className, activeLayout } = props;
  const { pillVariant, avatarVariant, propertyHeight } = getLayoutMetrics(activeLayout);
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const { labelMap } = useLabel();
  const storeType = useIssueStoreType();
  const {
    issues: { changeModulesInIssue },
  } = useIssues(storeType);
  const {
    issues: { addCycleToIssue, removeCycleFromIssue },
  } = useIssues(storeType);
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { getStateById } = useProjectState();
  const { data: userProfile } = useUserProfile();
  const { isMobile } = usePlatformOS();
  const projectDetails = getProjectById(issue.project_id);

  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();

  // derived values
  const stateDetails = getStateById(issue.state_id);
  const subIssueCount = getSubIssueCount(issue);

  const operationTarget = useMemo(() => getIssueOperationTarget(workspaceSlug, issue), [workspaceSlug, issue]);

  const issueOperations = useMemo(
    () => createIssueOperations(operationTarget, { changeModulesInIssue, addCycleToIssue, removeCycleFromIssue }),
    [operationTarget, changeModulesInIssue, addCycleToIssue, removeCycleFromIssue]
  );

  const {
    handleState,
    handlePriority,
    handleLabel,
    handleAssignee,
    handleStartDate,
    handleTargetDate,
    handleDateRangeUpdate,
    handleEstimate,
  } = createUpdateHandlers(issue, updateIssue);

  const handleModule = useCallback(
    (moduleIds: string[] | null) => {
      if (!issue?.module_ids || !moduleIds) return;
      applyModuleChanges(getModuleChanges(issue.module_ids, moduleIds), issueOperations);
    },
    [issueOperations, issue]
  );

  const handleCycle = useCallback(
    (cycleId: string | null) => {
      if (!issue) return;
      applyCycleChange(cycleId, issue, issueOperations);
    },
    [issue, issueOperations]
  );

  const workItemLink = getWorkItemLink(workspaceSlug, issue, projectDetails);

  const redirectToIssueDetail = () => router.push(`${workItemLink}#sub-issues`);

  if (!displayProperties || !issue.project_id) return null;

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled = getIsDateRangeEnabled(issue, displayProperties);
  const defaultLabelOptions = getDefaultLabelOptions(issue?.label_ids, labelMap);
  const showEstimate = isEstimateVisible(projectId, areEstimateEnabledByProjectId);

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <ListPropertiesOverflow className={className} enabled={activeLayout === "List"}>
      {/* basic properties */}
      {/* state */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className={propertyHeight} onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <StateSelect
            issueTypeId={issue.type_id}
            value={issue.state_id}
            onChange={handleState}
            projectId={issue.project_id}
            disabled={isReadOnly}
            variant={pillVariant}
            tooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* priority */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className={propertyHeight} onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <PrioritySelect
            value={issue?.priority}
            onChange={handlePriority}
            disabled={isReadOnly}
            variant={pillVariant}
            tooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      <IssueDateProperties
        issue={issue}
        displayProperties={displayProperties}
        isDateRangeEnabled={isDateRangeEnabled}
        activeLayout={activeLayout}
        pillVariant={pillVariant}
        propertyHeight={propertyHeight}
        isReadOnly={isReadOnly}
        weekStartsOn={userProfile?.start_of_the_week}
        stateDetails={stateDetails}
        onEvent={handleEventPropagation}
        onChangeRange={handleDateRangeUpdate}
        onChangeStart={handleStartDate}
        onChangeDue={handleTargetDate}
        t={t}
      />

      {/* assignee */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className={propertyHeight} onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <MemberSelect
            projectId={issue?.project_id ?? undefined}
            value={issue?.assignee_ids ?? []}
            onChange={handleAssignee}
            disabled={isReadOnly}
            multiple
            variant={getAssigneeVariant(issue.assignee_ids?.length, avatarVariant, pillVariant)}
            placeholder={t("common.assignees")}
            tooltip={{ heading: t("common.assignees") }}
          />
        </div>
      </WithDisplayPropertiesHOC>

      <ProjectRelationProperties
        issue={issue}
        projectDetails={projectDetails}
        displayProperties={displayProperties}
        propertyHeight={propertyHeight}
        pillVariant={pillVariant}
        isReadOnly={isReadOnly}
        onModuleChange={handleModule}
        onCycleChange={handleCycle}
        onEvent={handleEventPropagation}
      />

      {/* estimates */}
      <EstimateProperty
        show={showEstimate}
        issue={issue}
        projectId={issue.project_id}
        displayProperties={displayProperties}
        propertyHeight={propertyHeight}
        pillVariant={pillVariant}
        isReadOnly={isReadOnly}
        onEvent={handleEventPropagation}
        onChange={handleEstimate}
      />

      {/* extra render properties */}
      {/* sub-issues */}
      <SubIssuesProperty
        displayProperties={displayProperties}
        subIssueCount={subIssueCount}
        isMobile={isMobile}
        onOpen={redirectToIssueDetail}
      />

      {/* attachments */}
      <CountBadgeProperty
        displayProperties={displayProperties}
        displayPropertyKey="attachment_count"
        count={issue.attachment_count}
        label={translate("web.runtime.attachments_count", { count: issue.attachment_count ?? 0 })}
        icon={<AttachOutline className="h-3 w-3 flex-shrink-0" />}
        isMobile={isMobile}
        onEvent={handleEventPropagation}
      />

      {/* link */}
      <CountBadgeProperty
        displayProperties={displayProperties}
        displayPropertyKey="link"
        count={issue.link_count}
        label={translate("web.runtime.links_count", { count: issue.link_count ?? 0 })}
        icon={<LinkOutline className="h-3 w-3 flex-shrink-0" />}
        isMobile={isMobile}
        onEvent={handleEventPropagation}
      />

      {/* label */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="labels">
        <IssuePropertyLabels
          projectId={issue?.project_id || null}
          value={issue?.label_ids || []}
          defaultOptions={defaultLabelOptions}
          onChange={handleLabel}
          disabled={isReadOnly}
          renderByDefault={isMobile}
          hideDropdownArrow
          maxRender={3}
        />
      </WithDisplayPropertiesHOC>
    </ListPropertiesOverflow>
  );
});
