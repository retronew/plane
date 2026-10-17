/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// Plane Imports
import { CYCLE_STATUS, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { ChevronRightOutline } from "@makeplane/propel/icons";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import type { ICycle } from "@plane/types";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { useTimeZoneConverter } from "@/hooks/use-timezone-converter";
// services
import { CycleService } from "@/services/cycle.service";
import { formatCompactCycleDateRange } from "@/components/dropdowns/merged-date";

type Props = {
  workspaceSlug: string;
  projectId: string;
  cycleDetails: ICycle;
  handleClose: () => void;
  isArchived?: boolean;
};

const defaultValues: Partial<ICycle> = {
  start_date: null,
  end_date: null,
};

const cycleService = new CycleService();

export const CycleSidebarHeader = observer(function CycleSidebarHeader(props: Props) {
  const { workspaceSlug, projectId, cycleDetails, handleClose, isArchived = false } = props;
  // hooks
  const { allowPermissions } = useUserPermissions();
  const { data: userProfile } = useUserProfile();
  const { updateCycleDetails } = useCycle();
  const { t } = useTranslation();
  const { renderFormattedDateInUserTimezone } = useTimeZoneConverter(projectId);

  // form info
  const { control, reset } = useForm({
    defaultValues,
  });

  const cycleStatus = cycleDetails?.status?.toLocaleLowerCase();
  const isCompleted = cycleStatus === "completed";

  const currentCycle = CYCLE_STATUS.find((status) => status.value === cycleStatus);

  const submitChanges = async (data: Partial<ICycle>) => {
    if (!workspaceSlug || !projectId || !cycleDetails.id) return;
    await updateCycleDetails(workspaceSlug.toString(), projectId.toString(), cycleDetails.id.toString(), data);
  };

  useEffect(() => {
    if (cycleDetails)
      reset({
        ...cycleDetails,
      });
  }, [cycleDetails, reset]);

  const dateChecker = async (payload: any) => {
    try {
      const res = await cycleService.cycleDateCheck(workspaceSlug, projectId, payload);
      return res.status;
    } catch (_err) {
      return false;
    }
  };

  const handleDateChange = async (startDate: Date | undefined, endDate: Date | undefined) => {
    let isDateValid = false;

    const payload = {
      start_date: renderFormattedPayloadDate(startDate) || null,
      end_date: renderFormattedPayloadDate(endDate) || null,
    };

    if (payload?.start_date && payload.end_date) {
      isDateValid = await dateChecker({
        ...payload,
        cycle_id: cycleDetails.id,
      });
    } else {
      isDateValid = true;
    }
    if (isDateValid) {
      submitChanges(payload);
      setToast({
        type: "success",
        title: t("project_cycles.action.update.success.title"),
        message: t("project_cycles.action.update.success.description"),
      });
    } else {
      setToast({
        type: "error",
        title: t("project_cycles.action.update.failed.title"),
        message: t("project_cycles.action.update.error.already_exists"),
      });
    }
    return isDateValid;
  };

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <>
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-start gap-2 pt-6">
          <h4 className="min-w-0 flex-1 text-18 leading-6 font-semibold break-words text-primary">
            {cycleDetails.name}
          </h4>
          <button
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-layer-3 text-secondary transition-colors hover:bg-layer-3-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
            aria-label={t("close")}
            onClick={() => handleClose()}
          >
            <ChevronRightOutline className="size-4" />
          </button>
        </div>

        <Controller
          control={control}
          name="start_date"
          render={({ field: { value: startDateValue, onChange: onChangeStartDate } }) => (
            <div className="flex flex-wrap items-center gap-2">
              <Controller
                control={control}
                name="end_date"
                render={({ field: { value: endDateValue, onChange: onChangeEndDate } }) => (
                  <div className="h-7">
                    <DateRangeSelect
                      variant="pill-sm"
                      className="h-6! max-w-none! rounded-md! [&>span]:overflow-visible [&>span]:text-clip"
                      minDate={new Date()}
                      value={{
                        from: getDate(startDateValue) ?? null,
                        to: getDate(endDateValue) ?? null,
                      }}
                      onChange={(range) => {
                        void (async () => {
                          const from = range.from ?? undefined;
                          const to = range.to ?? undefined;
                          const isDateValid = await handleDateChange(from, to);
                          if (isDateValid) {
                            onChangeStartDate(from ? renderFormattedPayloadDate(from) : null);
                            onChangeEndDate(to ? renderFormattedPayloadDate(to) : null);
                          }
                        })();
                      }}
                      placeholder={translate("web.runtime.date_range_placeholder")}
                      tooltipHeading={t("project_cycles.in_your_timezone")}
                      tooltipContent={`${renderFormattedDateInUserTimezone(
                        cycleDetails.start_date ?? ""
                      )} → ${renderFormattedDateInUserTimezone(cycleDetails.end_date ?? "")}`}
                      mergeDates
                      formatLabel={({ from, to }) => formatCompactCycleDateRange(from, to)}
                      // show tooltip only if both start and end date are present
                      showTooltip={!!cycleDetails.start_date && !!cycleDetails.end_date}
                      disabled={!isEditingAllowed || isArchived || isCompleted}
                      weekStartsOn={userProfile?.start_of_the_week}
                    />
                  </div>
                )}
              />
              {currentCycle && (
                <span
                  className={`inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-12 font-medium whitespace-nowrap ${currentCycle.bgColor} ${currentCycle.textColor}`}
                >
                  {t(currentCycle.i18n_title)}
                </span>
              )}
            </div>
          )}
        />
      </div>
    </>
  );
});
