/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { observer } from "mobx-react";
import {
  DueDateOutline,
  LabelsOutline,
  MembersOutline,
  PriorityOutline,
  StartDateOutline,
  StateOutline,
  UserCircleOutline,
} from "@makeplane/propel/icons";
import { DateSelect, LabelSelect } from "@plane/blocks/property-select";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { ProjectStatusIcon } from "@/components/project/project-status-icon";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserProfile } from "@/hooks/store/user";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { useRefreshProjectActivities } from "./use-refresh-activities";

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-11 min-w-0 items-center">
      <dt className="flex w-[45%] shrink-0 items-center gap-2 text-body-xs-regular text-tertiary">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 text-body-xs-regular text-primary">{children}</dd>
    </div>
  );
}

const statusIcon = (status: ProjectCategory) => <ProjectStatusIcon group={status.group} color={status.color} />;
const selectedStatusIcon = (statuses: ProjectCategory[]) => (statuses[0] ? statusIcon(statuses[0]) : undefined);
const triggerClassName = "h-7 w-full min-w-0 overflow-hidden";

type Props = {
  project: IProject;
  workspaceSlug: string;
  disabled: boolean;
};

type SelectedLabel = {
  id: string;
  name: string;
};

const getSelectedStatus = (statuses: ProjectCategory[], status: IProject["status"]): ProjectCategory | null => {
  const selected = statuses.find((entry) => entry.id === status);
  if (selected) return selected;
  if (status) return null;
  return statuses.find((entry) => entry.is_default) ?? null;
};

const getSelectedLabels = (labelIds: string[] | undefined, labels: ProjectCategory[]): SelectedLabel[] =>
  (labelIds ?? []).map((id) => labels.find((label) => label.id === id) ?? { id, name: id });

const getMemberCount = (
  project: IProject,
  getProjectMemberIds: (projectId: string, includeGuestUsers: boolean) => string[] | null
) => (getProjectMemberIds(project.id, true) ?? project.members ?? []).length;

const getProjectDate = (date: string | null | undefined) => getDate(date) ?? null;

const toDatePayload = (date: Date | null) => (date ? renderFormattedPayloadDate(date) : null);

const getLeadId = (lead: IProject["project_lead"]) => (typeof lead === "object" ? lead?.id : lead);

function StatusProperty({
  statuses,
  selectedStatus,
  disabled,
  error,
  onChange,
}: {
  statuses: ProjectCategory[];
  selectedStatus: ProjectCategory | null;
  disabled: boolean;
  error: unknown;
  onChange: (statusId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <PropertyRow icon={StateOutline} label={t("state")}>
      <Select<ProjectCategory>
        getValues={() => statuses}
        value={selectedStatus}
        onChange={onChange}
        getOptionValue={(status) => status.id}
        getOptionLabel={(status) => status.name}
        getOptionIcon={statusIcon}
        disabled={disabled || Boolean(error)}
        placeholder={t("web.no_project_status")}
        showSearch
        pinSelected={false}
      >
        <Select.Trigger<ProjectCategory>
          variant="select-ghost-md"
          className={triggerClassName}
          aria-label={t("state")}
          prependIcon={selectedStatusIcon}
        >
          {(entries) => (
            <span className="min-w-0 flex-1 truncate text-left">{entries[0]?.name ?? t("web.no_project_status")}</span>
          )}
        </Select.Trigger>
      </Select>
    </PropertyRow>
  );
}

function PriorityProperty({
  priority,
  disabled,
  onChange,
}: {
  priority: IProject["priority"];
  disabled: boolean;
  onChange: (priority: IProject["priority"]) => void;
}) {
  const { t } = useTranslation();

  return (
    <PropertyRow icon={PriorityOutline} label={t("priority")}>
      <PrioritySelect
        value={priority ?? "none"}
        onChange={(value) => onChange(value ?? "none")}
        disabled={disabled}
        variant="select-ghost-md"
        className={triggerClassName}
        tooltip
      />
    </PropertyRow>
  );
}

function LeadProperty({
  lead,
  disabled,
  onChange,
}: {
  lead: IProject["project_lead"];
  disabled: boolean;
  onChange: (leadId: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <PropertyRow icon={UserCircleOutline} label={t("lead")}>
      <MemberSelect
        value={getLeadId(lead)}
        multiple={false}
        clearable
        showLabel
        placeholder={t("common.none")}
        clearLabel={t("common.none")}
        variant="select-ghost-md"
        disabled={disabled}
        className={triggerClassName}
        onChange={(id) => onChange(id || null)}
        tooltip={{ heading: t("lead") }}
      />
    </PropertyRow>
  );
}

function LabelsProperty({
  labels,
  selectedLabels,
  disabled,
  error,
  onChange,
}: {
  labels: ProjectCategory[];
  selectedLabels: SelectedLabel[];
  disabled: boolean;
  error: unknown;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <PropertyRow icon={LabelsOutline} label={t("labels")}>
      <LabelSelect
        getValues={async ({ search }) => ({
          results: labels.filter((label) =>
            label.name.toLocaleLowerCase().includes(search?.trim().toLocaleLowerCase() ?? "")
          ),
          next_page_results: false,
        })}
        value={selectedLabels}
        onChange={onChange}
        variant="select-ghost-md"
        disabled={disabled || Boolean(error)}
        placeholder={t("common.none")}
        className={triggerClassName}
        tooltip={{ heading: t("labels") }}
      />
    </PropertyRow>
  );
}

function DateProperty({
  icon,
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  placeholder,
  weekStartsOn,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: Date | null;
  onChange: (date: string | null | undefined) => void;
  minDate?: Date | null;
  maxDate?: Date | null;
  disabled: boolean;
  placeholder: string;
  weekStartsOn: ComponentProps<typeof DateSelect>["weekStartsOn"];
}) {
  return (
    <PropertyRow icon={icon} label={label}>
      <DateSelect
        value={value}
        onChange={(date) => onChange(toDatePayload(date))}
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
        disabled={disabled}
        variant="select-ghost-md"
        placeholder={placeholder}
        clearable
        weekStartsOn={weekStartsOn}
        className={triggerClassName}
      />
    </PropertyRow>
  );
}

export const ProjectOverviewProperties = observer(function ProjectOverviewProperties({
  project,
  workspaceSlug,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { updateProject } = useProject();
  const refreshActivities = useRefreshProjectActivities(workspaceSlug, project.id);
  const { statuses, statesEnabled, labels, error } = useProjectCategories(workspaceSlug);
  const {
    project: { getProjectMemberIds },
  } = useMember();
  const { data: profile } = useUserProfile();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const isDisabled = disabled || busy;
  const selectedStatus = getSelectedStatus(statuses, project.status);
  const selectedLabels = getSelectedLabels(project.labels, labels);
  const memberCount = getMemberCount(project, getProjectMemberIds);
  const startDate = getProjectDate(project.start_date);
  const targetDate = getProjectDate(project.target_date);

  const save = async (changes: Partial<IProject>) => {
    if (disabled || saving.current || !workspaceSlug) return;
    saving.current = true;
    setBusy(true);
    try {
      await updateProject(workspaceSlug, project.id, changes);
      void refreshActivities();
    } catch {
      setToast({ type: "error", title: t("web.configuration_save_error") });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0">
      <h2 className="text-16 font-semibold text-primary">{t("common.properties")}</h2>
      <dl className="mt-3">
        {statesEnabled && (
          <StatusProperty
            statuses={statuses}
            selectedStatus={selectedStatus}
            disabled={isDisabled}
            error={error}
            onChange={(status) => void save({ status })}
          />
        )}
        <PriorityProperty
          priority={project.priority}
          disabled={isDisabled}
          onChange={(priority) => void save({ priority })}
        />
        <LeadProperty
          lead={project.project_lead}
          disabled={isDisabled}
          onChange={(projectLead) => void save({ project_lead: projectLead })}
        />
        <PropertyRow icon={MembersOutline} label={t("members")}>
          <span className="px-2">{t("member", { count: memberCount })}</span>
        </PropertyRow>
        <LabelsProperty
          labels={labels}
          selectedLabels={selectedLabels}
          disabled={isDisabled}
          error={error}
          onChange={(ids) => void save({ labels: ids })}
        />
        <DateProperty
          icon={StartDateOutline}
          label={t("start_date")}
          value={startDate}
          onChange={(date) => void save({ start_date: date })}
          maxDate={targetDate}
          disabled={isDisabled}
          placeholder={t("web.set_date")}
          weekStartsOn={profile?.start_of_the_week}
        />
        <DateProperty
          icon={DueDateOutline}
          label={t("due_date")}
          value={targetDate}
          onChange={(date) => void save({ target_date: date })}
          minDate={startDate}
          disabled={isDisabled}
          placeholder={t("web.set_date")}
          weekStartsOn={profile?.start_of_the_week}
        />
      </dl>
    </section>
  );
});
