import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { ETabIndices } from "@plane/constants";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { CalendarOutline, ParentOutline } from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import type { ISearchIssueResponse, TIssue } from "@plane/types";
import { renderFormattedPayloadDate, getDate, getTabIndex } from "@plane/utils";
// components
import { CycleSelect } from "@/components/dropdowns/cycle/cycle-select";
import { EstimateSelect } from "@/components/dropdowns/estimate/estimate-select";
import { IntakeStateSelect } from "@/components/dropdowns/intake-state/intake-state-select";
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ModuleSelect } from "@/components/dropdowns/module/module-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { ParentIssuesListModal } from "@/components/issues/parent-issues-list-modal";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useUserProfile } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

type TInboxIssueProperties = {
  workspaceSlug: string;
  projectId: string;
  data: Partial<TIssue>;
  handleData: (issueKey: keyof Partial<TIssue>, issueValue: Partial<TIssue>[keyof Partial<TIssue>]) => void;
  isVisible?: boolean;
};

type TDateInput = Parameters<typeof getDate>[0];

const getDateBounds = (startDate: TDateInput, targetDate: TDateInput) => {
  const minDate = getDate(startDate);
  minDate?.setDate(minDate.getDate());

  const maxDate = getDate(targetDate);
  maxDate?.setDate(maxDate.getDate());

  return { minDate, maxDate };
};

const getDateValue = (date: TDateInput) => getDate(date) ?? null;

const getDatePayload = (date: Date | null) => (date ? renderFormattedPayloadDate(date) : "");

const getIdsOrEmpty = <T,>(ids: T[] | null | undefined): T[] => ids || [];

const getAssigneeVariant = (assigneeIds: string[]) => (assigneeIds.length ? "avatar-group-md" : "pill-md");

const getCycleId = (cycleId: string | null | undefined) => cycleId || null;

const getEstimatePoint = (estimatePoint: string | null | undefined) => estimatePoint || undefined;

const shouldShowEstimate = (
  isVisible: boolean,
  projectId: string,
  areEstimateEnabledByProjectId: (projectId: string) => boolean
) => isVisible && !!projectId && areEstimateEnabledByProjectId(projectId);

type TParentIssueFieldProps = {
  projectId: string;
  typeId?: string | null;
  tabIndex: number | undefined;
  selectedIssue: ISearchIssueResponse | undefined;
  isModalOpen: boolean;
  onModalOpenChange: (isOpen: boolean) => void;
  onChange: (issue: ISearchIssueResponse) => void;
  onRemove: () => void;
};

function ParentIssueField({
  projectId,
  typeId,
  tabIndex,
  selectedIssue,
  isModalOpen,
  onModalOpenChange,
  onChange,
  onRemove,
}: TParentIssueFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="h-7">
      {selectedIssue ? (
        <div className="h-full w-full">
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  tabIndex={tabIndex}
                  className="flex h-full cursor-pointer items-center justify-between gap-1 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-11 hover:bg-layer-1"
                >
                  <ParentOutline className="h-3 w-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {`${selectedIssue.project__identifier}-${selectedIssue.sequence_id}`}
                  </span>
                </button>
              }
            />
            <MenuContent side="bottom" align="start">
              <MenuItem label={t("web.change_parent_work_item")} onClick={() => onModalOpenChange(true)} />
              <MenuItem label={t("web.remove_parent_work_item")} onClick={onRemove} />
            </MenuContent>
          </Menu>
        </div>
      ) : (
        <button
          type="button"
          className="flex h-full cursor-pointer items-center justify-between gap-1 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-11 hover:bg-layer-1"
          onClick={() => onModalOpenChange(true)}
        >
          <ParentOutline className="h-3 w-3 flex-shrink-0" />
          <span className="whitespace-nowrap">{t("web.add_parent")}</span>
        </button>
      )}

      <ParentIssuesListModal
        isOpen={isModalOpen}
        handleClose={() => onModalOpenChange(false)}
        onChange={onChange}
        projectId={projectId}
        issueId={undefined}
        typeId={typeId}
      />
    </div>
  );
}

export const InboxIssueProperties = observer(function InboxIssueProperties(props: TInboxIssueProperties) {
  const { workspaceSlug, projectId, data, handleData, isVisible = false } = props;
  // translation
  const { t } = useTranslation();
  // hooks
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { data: userProfile } = useUserProfile();
  const { isMobile } = usePlatformOS();
  // states
  const [parentIssueModalOpen, setParentIssueModalOpen] = useState(false);
  const [selectedParentIssue, setSelectedParentIssue] = useState<ISearchIssueResponse | undefined>(undefined);

  const { getIndex } = getTabIndex(ETabIndices.INTAKE_ISSUE_FORM, isMobile);

  // derived values
  const { minDate } = getDateBounds(data?.start_date, data?.target_date);
  const assigneeIds = getIdsOrEmpty(data?.assignee_ids);
  const weekStartsOn = userProfile?.start_of_the_week;
  const showEstimate = shouldShowEstimate(isVisible, projectId, areEstimateEnabledByProjectId);

  const handleParentIssueChange = (issue: ISearchIssueResponse) => {
    handleData("parent_id", issue?.id);
    setSelectedParentIssue(issue);
  };

  const handleParentIssueRemove = () => {
    handleData("parent_id", "");
    setSelectedParentIssue(undefined);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {/* intake state */}
      <IntakeStateSelect
        workspaceSlug={workspaceSlug}
        value={data?.state_id}
        onChange={(stateId) => handleData("state_id", stateId)}
        projectId={projectId}
        variant="pill-md"
        tabIndex={getIndex("state_id")}
      />

      {/* priority */}
      <PrioritySelect
        value={data?.priority}
        onChange={(priority) => handleData("priority", priority)}
        variant="pill-md"
        tabIndex={getIndex("priority")}
      />

      {/* Assignees */}
      <MemberSelect
        projectId={projectId}
        value={assigneeIds}
        onChange={(ids) => handleData("assignee_ids", ids)}
        placeholder={t("web.assignees")}
        multiple
        variant={getAssigneeVariant(assigneeIds)}
        tabIndex={getIndex("assignee_ids")}
      />

      {/* labels */}
      <LabelSelect
        projectId={projectId}
        value={getIdsOrEmpty(data?.label_ids)}
        onChange={(labelIds) => handleData("label_ids", labelIds)}
        variant="pill-md"
        placeholder={t("labels")}
        tabIndex={getIndex("label_ids")}
      />

      {/* start date */}
      {isVisible && (
        <DateSelect
          value={getDateValue(data?.start_date)}
          onChange={(date) => handleData("start_date", getDatePayload(date))}
          minDate={minDate}
          placeholder={t("web.start_date")}
          icon={<CalendarOutline />}
          weekStartsOn={weekStartsOn}
          clearable
          clearLabel={t("common.clear")}
          variant="pill-md"
          tabIndex={getIndex("start_date")}
        />
      )}

      {/* due date */}
      <DateSelect
        value={getDateValue(data?.target_date)}
        onChange={(date) => handleData("target_date", getDatePayload(date))}
        minDate={minDate}
        placeholder={t("web.due_date")}
        icon={<CalendarOutline />}
        weekStartsOn={weekStartsOn}
        clearable
        clearLabel={t("common.clear")}
        variant="pill-md"
        tabIndex={getIndex("target_date")}
      />

      {/* cycle */}
      {isVisible && (
        <CycleSelect
          value={getCycleId(data?.cycle_id)}
          onChange={(cycleId) => handleData("cycle_id", cycleId)}
          projectId={projectId}
          placeholder={t("web.cycle")}
          variant="pill-md"
          tabIndex={getIndex("cycle_id")}
        />
      )}

      {/* module */}
      {isVisible && (
        <ModuleSelect
          multiple
          projectId={projectId}
          value={getIdsOrEmpty(data?.module_ids)}
          onChange={(moduleIds) => handleData("module_ids", moduleIds)}
          placeholder={t("web.modules")}
          variant="pill-md"
          tabIndex={getIndex("module_ids")}
        />
      )}

      {/* estimate */}
      {showEstimate && (
        <EstimateSelect
          value={getEstimatePoint(data?.estimate_point)}
          onChange={(estimatePoint) => handleData("estimate_point", estimatePoint)}
          projectId={projectId}
          variant="pill-md"
          placeholder={t("web.estimate")}
          tabIndex={getIndex("estimate_point")}
        />
      )}

      {/* add parent */}
      {isVisible && (
        <ParentIssueField
          projectId={projectId}
          typeId={data.type_id}
          tabIndex={getIndex("parent_id")}
          selectedIssue={selectedParentIssue}
          isModalOpen={parentIssueModalOpen}
          onModalOpenChange={setParentIssueModalOpen}
          onChange={handleParentIssueChange}
          onRemove={handleParentIssueRemove}
        />
      )}
    </div>
  );
});
