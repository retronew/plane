/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { SyntheticEvent } from "react";
import React, { useRef } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarOutline, ModuleOutline, WorkItemsOutline } from "@makeplane/propel/icons";
// plane package imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { LinearProgress } from "@makeplane/propel/components/linear-progress";
import { setPromiseToast, setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IModule } from "@plane/types";
import { FavoriteStar } from "@plane/blocks/common";
import { DateRangeSelect } from "@plane/blocks/property-select";
import type { DateRangeValue, WeekStart } from "@plane/blocks/property-select";
import { formatCompactDateRange, getDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { handleTriggerKeyDown } from "@/components/common/trigger-guard";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ModuleQuickActions } from "@/components/modules";
import { ModuleStatusDropdown } from "@/components/modules/module-status-dropdown";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { translate } from "@plane/i18n";

type Props = {
  moduleId: string;
};

type TModuleCardActionContext = {
  workspaceSlug: string | string[] | undefined;
  projectId: string | string[] | undefined;
  moduleId: string;
  addModuleToFavorites: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  removeModuleFromFavorites: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  updateModuleDetails: (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<IModule>
  ) => Promise<IModule>;
  setFavoriteMenuOpen: (value: boolean) => void;
  storedValue: boolean | null;
};

const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
  e.stopPropagation();
  e.preventDefault();
};

const getModuleActionParams = (
  workspaceSlug: string | string[] | undefined,
  projectId: string | string[] | undefined,
  moduleId: string
) => {
  if (!workspaceSlug || !projectId) return null;
  return { workspaceSlug: workspaceSlug.toString(), projectId: projectId.toString(), moduleId };
};

const handleAddToFavorites = (e: React.MouseEvent<HTMLButtonElement>, context: TModuleCardActionContext) => {
  e.stopPropagation();
  e.preventDefault();
  const params = getModuleActionParams(context.workspaceSlug, context.projectId, context.moduleId);
  if (!params) return;

  const addToFavoritePromise = context
    .addModuleToFavorites(params.workspaceSlug, params.projectId, params.moduleId)
    .then(() => {
      if (!context.storedValue) context.setFavoriteMenuOpen(true);
      return undefined;
    });

  setPromiseToast(addToFavoritePromise, {
    loading: translate("web.adding_module_to_favorites"),
    success: {
      title: translate("toast.success"),
      message: () => "Module added to favorites.",
    },
    error: {
      title: translate("toast.error"),
      message: () => "Couldn't add the module to favorites. Please try again.",
    },
  });
};

const handleRemoveFromFavorites = (e: React.MouseEvent<HTMLButtonElement>, context: TModuleCardActionContext) => {
  e.stopPropagation();
  e.preventDefault();
  const params = getModuleActionParams(context.workspaceSlug, context.projectId, context.moduleId);
  if (!params) return;

  const removeFromFavoritePromise = context.removeModuleFromFavorites(
    params.workspaceSlug,
    params.projectId,
    params.moduleId
  );

  setPromiseToast(removeFromFavoritePromise, {
    loading: translate("web.removing_module_from_favorites"),
    success: {
      title: translate("toast.success"),
      message: () => "Module removed from favorites.",
    },
    error: {
      title: translate("toast.error"),
      message: () => "Couldn't remove the module from favorites. Please try again.",
    },
  });
};

const handleFavoriteClick = (
  e: React.MouseEvent<HTMLButtonElement>,
  isFavorite: boolean,
  context: TModuleCardActionContext
) => {
  if (isFavorite) handleRemoveFromFavorites(e, context);
  else handleAddToFavorites(e, context);
};

const handleModuleDetailsChange = async (payload: Partial<IModule>, context: TModuleCardActionContext) => {
  const params = getModuleActionParams(context.workspaceSlug, context.projectId, context.moduleId);
  if (!params) return;

  await context
    .updateModuleDetails(params.workspaceSlug, params.projectId, params.moduleId, payload)
    .then(() => {
      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.module_updated_successfully"),
      });
      return undefined;
    })
    .catch((err: { detail?: string }) => {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: err?.detail ?? translate("web.module_could_not_be_updated_please_try_again"),
      });
    });
};

const getModuleCardStats = (moduleDetails: IModule) => {
  const moduleTotalIssues =
    moduleDetails.backlog_issues +
    moduleDetails.unstarted_issues +
    moduleDetails.started_issues +
    moduleDetails.completed_issues +
    moduleDetails.cancelled_issues;

  const moduleCompletedIssues = moduleDetails.completed_issues;
  const progressValue = moduleTotalIssues > 0 ? (moduleCompletedIssues / moduleTotalIssues) * 100 : 0;

  const issueCount =
    moduleTotalIssues === 0 || moduleTotalIssues === moduleCompletedIssues
      ? translate("web.runtime.items_count", { count: moduleTotalIssues })
      : translate("web.runtime.module_work_item_progress", {
          completed: moduleCompletedIssues,
          total: moduleTotalIssues,
        });

  return { issueCount, progressValue };
};

const getModuleDateRange = (moduleDetails: IModule): DateRangeValue => ({
  from: getDate(moduleDetails.start_date) ?? null,
  to: getDate(moduleDetails.target_date) ?? null,
});

const getDateRangePayload = (range: DateRangeValue): Partial<IModule> => ({
  start_date: range.from ? renderFormattedPayloadDate(range.from) : null,
  target_date: range.to ? renderFormattedPayloadDate(range.to) : null,
});

const getIsDisabled = (isEditingAllowed: boolean, archivedAt: string | null) => !isEditingAllowed || !!archivedAt;

type TModuleCardHeaderActionsProps = {
  moduleDetails: IModule;
  isDisabled: boolean;
  onModuleDetailsChange: (payload: Partial<IModule>) => Promise<void>;
};

const ModuleCardHeaderActions = observer(function ModuleCardHeaderActions({
  moduleDetails,
  isDisabled,
  onModuleDetailsChange,
}: TModuleCardHeaderActionsProps) {
  const moduleStatus = MODULE_STATUS.find((status) => status.value === moduleDetails.status);

  // Ruling 38: guard both halves — the card root is a `Link`.
  return (
    <div
      className="flex items-center gap-2"
      role="presentation"
      onClick={handleEventPropagation}
      onKeyDown={handleTriggerKeyDown}
    >
      {moduleStatus && (
        <ModuleStatusDropdown
          variant="pill-sm"
          isDisabled={isDisabled}
          moduleDetails={moduleDetails}
          handleModuleDetailsChange={onModuleDetailsChange}
        />
      )}
    </div>
  );
});

type TModuleCardDateRangeProps = {
  moduleDetails: IModule;
  isDisabled: boolean;
  weekStartsOn: WeekStart | undefined;
  onDateRangeChange: (range: DateRangeValue) => void;
};

const ModuleCardDateRange = observer(function ModuleCardDateRange({
  moduleDetails,
  isDisabled,
  weekStartsOn,
  onDateRangeChange,
}: TModuleCardDateRangeProps) {
  // Ruling 38: the whole card is a `Link`, so the trigger's click and keyboard
  // activation must not reach it.
  return (
    <div
      className="flex min-w-0 items-center py-0.5"
      role="presentation"
      onClick={handleEventPropagation}
      onKeyDown={handleTriggerKeyDown}
    >
      <DateRangeSelect
        variant="pill-sm"
        className={`min-w-0 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        mergeDates
        formatLabel={formatCompactDateRange}
        value={getModuleDateRange(moduleDetails)}
        onChange={onDateRangeChange}
        placeholder={translate("web.start_date_end_date")}
        weekStartsOn={weekStartsOn}
        disabled={isDisabled}
        icon={<CalendarOutline aria-hidden="true" />}
      />
    </div>
  );
});

export const ModuleCardItem = observer(function ModuleCardItem(props: Props) {
  const { moduleId } = props;
  // refs
  const parentRef = useRef(null);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getModuleById, addModuleToFavorites, removeModuleFromFavorites, updateModuleDetails } = useModule();
  const { data: userProfile } = useUserProfile();
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue } = useLocalStorage<boolean>(IS_FAVORITE_MENU_OPEN, false);
  // derived values
  const moduleDetails = getModuleById(moduleId);
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const { isMobile } = usePlatformOS();

  if (!moduleDetails) return null;

  const isDisabled = getIsDisabled(isEditingAllowed, moduleDetails.archived_at);
  const { issueCount, progressValue } = getModuleCardStats(moduleDetails);

  const actionContext: TModuleCardActionContext = {
    workspaceSlug,
    projectId,
    moduleId,
    addModuleToFavorites,
    removeModuleFromFavorites,
    updateModuleDetails,
    setFavoriteMenuOpen: toggleFavoriteMenu,
    storedValue,
  };

  return (
    <div className="relative" data-prevent-progress>
      <Link
        ref={parentRef}
        href={`/${workspaceSlug}/projects/${moduleDetails.project_id}/modules/${moduleDetails.id}`}
        className="group/module-card focus-visible:outline-accent-primary relative flex w-full min-w-0 flex-col rounded-xl border border-subtle bg-layer-1 p-1 shadow-none transition-colors hover:bg-layer-1-hover focus-visible:outline-2"
      >
        <div className="relative flex h-[108px] shrink-0 flex-col justify-between overflow-hidden rounded-lg bg-layer-2 p-3">
          <span className="grid size-9 place-items-center rounded-md bg-layer-1">
            <ModuleOutline className="size-5 text-secondary" />
          </span>
          <div className="flex items-center gap-3">
            <LinearProgress
              value={progressValue}
              size="md"
              variant="brand"
              showValue={false}
              aria-label={translate("web.module_progress")}
            />
            <span className="shrink-0 text-12 text-tertiary tabular-nums">{Math.round(progressValue)}%</span>
          </div>
        </div>
        <div>
          <div className="flex items-start justify-between gap-2 px-2 pt-1.5">
            <Tooltip label={moduleDetails.name} layout="stacked" disabled={isMobile}>
              <span className="min-w-0 flex-1 truncate text-14 font-medium text-primary">{moduleDetails.name}</span>
            </Tooltip>

            <div
              className="absolute top-4 right-4 z-10 flex shrink-0 items-center gap-1.5 rounded-md bg-layer-2/80 opacity-0 transition-opacity group-focus-within/module-card:opacity-100 group-hover/module-card:opacity-100 [@media(hover:none)]:opacity-100"
              role="presentation"
              onClick={handleEventPropagation}
              onKeyDown={handleTriggerKeyDown}
            >
              {isEditingAllowed && (
                <FavoriteStar
                  onClick={(e) => handleFavoriteClick(e, !!moduleDetails.is_favorite, actionContext)}
                  selected={!!moduleDetails.is_favorite}
                />
              )}
              {workspaceSlug && projectId && (
                <ModuleQuickActions
                  parentRef={parentRef}
                  moduleId={moduleId}
                  projectId={projectId.toString()}
                  workspaceSlug={workspaceSlug.toString()}
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1 px-2 pb-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2 py-1">
            <div className="flex items-center gap-1.5 text-secondary">
              <WorkItemsOutline className="h-4 w-4 text-tertiary" />
              <span className="text-11 text-tertiary">{issueCount ?? "0 Work item"}</span>
            </div>
            <div role="presentation" onClick={handleEventPropagation} onKeyDown={handleTriggerKeyDown}>
              <MemberSelect
                variant="pill-sm"
                value={moduleDetails.lead_id}
                projectId={projectId?.toString()}
                disabled={isDisabled}
                placeholder={translate("web.no_lead")}
                clearable
                onChange={(lead) => {
                  void handleModuleDetailsChange({ lead_id: lead || null }, actionContext);
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <ModuleCardDateRange
              moduleDetails={moduleDetails}
              isDisabled={isDisabled}
              weekStartsOn={userProfile?.start_of_the_week}
              onDateRangeChange={(range) => {
                void handleModuleDetailsChange(getDateRangePayload(range), actionContext);
              }}
            />
            <ModuleCardHeaderActions
              moduleDetails={moduleDetails}
              isDisabled={isDisabled}
              onModuleDetailsChange={(payload) => handleModuleDetailsChange(payload, actionContext)}
            />
          </div>
        </div>
      </Link>
    </div>
  );
});
