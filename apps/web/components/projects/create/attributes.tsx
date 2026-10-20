/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { DateSelect } from "@plane/blocks/property-select";
import { CalendarOutline } from "@makeplane/propel/icons";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { useUserProfile } from "@/hooks/store/user";
import { Controller, useFormContext } from "react-hook-form";
// plane imports
import { Select } from "@plane/blocks/select";
import { NETWORK_CHOICES, ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { getDate, renderFormattedPayloadDate, getTabIndex } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ProjectNetworkIcon } from "@/components/project/project-network-icon";
import { PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME } from "@/components/project/create/attribute-styles";

const projectNetworkOptionIcon = (network: (typeof NETWORK_CHOICES)[number]) => (
  <ProjectNetworkIcon iconKey={network.iconKey} className="size-3.5" />
);

type Props = {
  isMobile?: boolean;
  status?: ReactNode;
  labels?: ReactNode;
};

function ProjectAttributes(props: Props) {
  const { isMobile = false, status, labels } = props;
  const { t } = useTranslation();
  const { control, watch } = useFormContext<IProject>();
  const { data: userProfile } = useUserProfile();
  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 [&_button]:px-2.5!">
      <div className="contents">
        {status}
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <PrioritySelect
              value={field.value === "none" ? null : field.value}
              onChange={field.onChange}
              variant="pill-md"
              className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
            />
          )}
        />
        <Controller
          name="project_lead"
          control={control}
          render={({ field: { value, onChange } }) => {
            if (value === undefined || value === null || typeof value === "string")
              return (
                <MemberSelect
                  value={value ?? null}
                  // Re-picking the current lead (or clearing it) unsets it, as the legacy picker did.
                  onChange={(lead) => onChange(!lead || lead === value ? null : lead)}
                  placeholder={t("lead")}
                  multiple={false}
                  variant="pill-md"
                  className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
                  tabIndex={getIndex("lead")}
                />
              );
            else return <></>;
          }}
        />
        <Controller
          name="member_ids"
          control={control}
          render={({ field }) => (
            <MemberSelect
              multiple
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder={t("common.members")}
              variant="pill-md"
              className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
            />
          )}
        />
      </div>
      <div className="contents">
        <Controller
          name="start_date"
          control={control}
          render={({ field }) => (
            <DateSelect
              variant="pill-md"
              clearable
              side="top"
              showTooltip
              tooltipHeading={t("start_date")}
              className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
              value={getDate(field.value) ?? null}
              maxDate={getDate(watch("target_date")) ?? undefined}
              onChange={(date) => field.onChange(date ? renderFormattedPayloadDate(date) : null)}
              placeholder={t("start_date")}
              icon={<CalendarOutline />}
              weekStartsOn={userProfile?.start_of_the_week}
            />
          )}
        />
        <Controller
          name="target_date"
          control={control}
          render={({ field }) => (
            <DateSelect
              variant="pill-md"
              clearable
              side="top"
              showTooltip
              tooltipHeading={t("target_date")}
              className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
              value={getDate(field.value) ?? null}
              minDate={getDate(watch("start_date")) ?? undefined}
              onChange={(date) => field.onChange(date ? renderFormattedPayloadDate(date) : null)}
              placeholder={t("target_date")}
              icon={<CalendarOutline />}
              weekStartsOn={userProfile?.start_of_the_week}
            />
          )}
        />
        {labels}
        <Controller
          name="network"
          control={control}
          render={({ field: { onChange, value } }) => {
            const currentNetwork = NETWORK_CHOICES.find((n) => n.key === value);

            return (
              <Select<(typeof NETWORK_CHOICES)[number]>
                getValues={() => NETWORK_CHOICES}
                value={currentNetwork ?? null}
                getOptionValue={(network) => String(network.key)}
                getOptionLabel={(network) => t(network.i18n_label)}
                getOptionDescription={(network) => t(network.description)}
                getOptionIcon={projectNetworkOptionIcon}
                onChange={(next) => {
                  if (next !== null) onChange(Number(next));
                }}
                showSearch={false}
              >
                <Select.Trigger
                  variant="pill-md"
                  className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
                  tabIndex={getIndex("network")}
                  aria-label={`${t("select_network")}, ${currentNetwork ? t(currentNetwork.i18n_label) : ""}`}
                  prependIcon={
                    currentNetwork ? (
                      <ProjectNetworkIcon iconKey={currentNetwork.iconKey} className="size-3.5" />
                    ) : undefined
                  }
                >
                  <span className="truncate">
                    {currentNetwork ? t(currentNetwork.i18n_label) : t("select_network")}
                  </span>
                </Select.Trigger>
              </Select>
            );
          }}
        />
      </div>
    </div>
  );
}

export default ProjectAttributes;

export { ProjectAttributes };
