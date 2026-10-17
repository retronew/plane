/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
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
  const selectedStatus =
    statuses.find((status) => status.id === project.status) ??
    (!project.status ? statuses.find((status) => status.is_default) : undefined) ??
    null;
  const selectedLabels = (project.labels ?? []).map(
    (id) => labels.find((label) => label.id === id) ?? { id, name: id }
  );
  const memberCount = (getProjectMemberIds(project.id, true) ?? project.members ?? []).length;
  const startDate = getDate(project.start_date) ?? null;
  const targetDate = getDate(project.target_date) ?? null;

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
          <PropertyRow icon={StateOutline} label={t("state")}>
            <Select<ProjectCategory>
              getValues={() => statuses}
              value={selectedStatus}
              onChange={(status) => void save({ status })}
              getOptionValue={(status) => status.id}
              getOptionLabel={(status) => status.name}
              getOptionIcon={statusIcon}
              disabled={isDisabled || Boolean(error)}
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
                {(entries) => <span className="truncate">{entries[0]?.name ?? t("web.no_project_status")}</span>}
              </Select.Trigger>
            </Select>
          </PropertyRow>
        )}
        <PropertyRow icon={PriorityOutline} label={t("priority")}>
          <PrioritySelect
            value={project.priority ?? "none"}
            onChange={(priority) => void save({ priority: priority ?? "none" })}
            disabled={isDisabled}
            variant="select-ghost-md"
            className={triggerClassName}
            tooltip
          />
        </PropertyRow>
        <PropertyRow icon={UserCircleOutline} label={t("lead")}>
          <MemberSelect
            value={typeof project.project_lead === "object" ? project.project_lead?.id : project.project_lead}
            multiple={false}
            clearable
            showLabel
            placeholder={t("common.none")}
            clearLabel={t("common.none")}
            variant="select-ghost-md"
            disabled={isDisabled}
            className={triggerClassName}
            onChange={(id) => void save({ project_lead: id || null })}
            tooltip={{ heading: t("lead") }}
          />
        </PropertyRow>
        <PropertyRow icon={MembersOutline} label={t("members")}>
          <span className="px-2">{t("member", { count: memberCount })}</span>
        </PropertyRow>
        <PropertyRow icon={LabelsOutline} label={t("labels")}>
          <LabelSelect
            getValues={async ({ search }) => ({
              results: labels.filter((label) =>
                label.name.toLocaleLowerCase().includes(search?.trim().toLocaleLowerCase() ?? "")
              ),
              next_page_results: false,
            })}
            value={selectedLabels}
            onChange={(ids) => void save({ labels: ids })}
            variant="select-ghost-md"
            disabled={isDisabled || Boolean(error)}
            placeholder={t("common.none")}
            className={triggerClassName}
            tooltip={{ heading: t("labels") }}
          />
        </PropertyRow>
        <PropertyRow icon={StartDateOutline} label={t("start_date")}>
          <DateSelect
            value={startDate}
            onChange={(date) => void save({ start_date: date ? renderFormattedPayloadDate(date) : null })}
            maxDate={targetDate ?? undefined}
            disabled={isDisabled}
            variant="select-ghost-md"
            placeholder={t("web.set_date")}
            clearable
            weekStartsOn={profile?.start_of_the_week}
            className={triggerClassName}
          />
        </PropertyRow>
        <PropertyRow icon={DueDateOutline} label={t("due_date")}>
          <DateSelect
            value={targetDate}
            onChange={(date) => void save({ target_date: date ? renderFormattedPayloadDate(date) : null })}
            minDate={startDate ?? undefined}
            disabled={isDisabled}
            variant="select-ghost-md"
            placeholder={t("web.set_date")}
            clearable
            weekStartsOn={profile?.start_of_the_week}
            className={triggerClassName}
          />
        </PropertyRow>
      </dl>
    </section>
  );
});
