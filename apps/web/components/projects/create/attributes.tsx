/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { DateRangeSelect } from "@plane/blocks/property-select";
import { CalendarOutline } from "@makeplane/propel/icons";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { useUserProfile } from "@/hooks/store/user";
import { Controller, useFormContext } from "react-hook-form";
// plane imports
import { Select, SelectTrigger, SelectContent, SelectList, SelectItem } from "@makeplane/propel/components/select";
import { NETWORK_CHOICES, ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { getDate, renderFormattedPayloadDate, getTabIndex } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ProjectNetworkIcon } from "@/components/project/project-network-icon";
import { PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME } from "@/components/project/create/attribute-styles";

type Props = {
  isMobile?: boolean;
};

function ProjectAttributes(props: Props) {
  const { isMobile = false } = props;
  const { t } = useTranslation();
  const { control } = useFormContext<IProject>();
  const { data: userProfile } = useUserProfile();
  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Controller
        name="network"
        control={control}
        render={({ field: { onChange, value } }) => {
          const currentNetwork = NETWORK_CHOICES.find((n) => n.key === value);

          return (
            <Select<number>
              items={NETWORK_CHOICES.map((network) => ({ value: network.key, label: t(network.i18n_label) }))}
              value={value ?? 2}
              onValueChange={(next) => {
                if (next !== null) onChange(next);
              }}
            >
              <SelectTrigger
                variant="pill"
                size="sm"
                tabIndex={getIndex("network")}
                aria-label={`${t("select_network")}, ${currentNetwork ? t(currentNetwork.i18n_label) : ""}`}
                icon={
                  currentNetwork ? (
                    <ProjectNetworkIcon iconKey={currentNetwork.iconKey} className="size-3.5" />
                  ) : undefined
                }
              />
              <SelectContent sizing="auto" alignItemWithTrigger={false}>
                <SelectList>
                  {NETWORK_CHOICES.map((network) => (
                    <SelectItem
                      key={network.key}
                      value={network.key}
                      label={t(network.i18n_label)}
                      description={t(network.description)}
                      icon={<ProjectNetworkIcon iconKey={network.iconKey} className="size-4" />}
                    />
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          );
        }}
      />
      <Controller
        name="start_date"
        control={control}
        render={({ field: start }) => (
          <Controller
            name="target_date"
            control={control}
            render={({ field: end }) => (
              <DateRangeSelect
                variant="pill-md"
                clearable
                mergeDates
                side="top"
                showTooltip
                tooltipHeading={t("web.runtime.date_range_placeholder")}
                className={`${PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME} max-w-none!`}
                value={{ from: getDate(start.value) ?? null, to: getDate(end.value) ?? null }}
                onChange={(range) => {
                  start.onChange(range.from ? renderFormattedPayloadDate(range.from) : null);
                  end.onChange(range.to ? renderFormattedPayloadDate(range.to) : null);
                }}
                placeholder={t("web.runtime.date_range_placeholder")}
                icon={<CalendarOutline />}
                weekStartsOn={userProfile?.start_of_the_week}
              />
            )}
          />
        )}
      />
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
  );
}

export default ProjectAttributes;

export { ProjectAttributes };
