/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { SyntheticEvent } from "react";
import React, { useRef } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { CalendarOutline, InfoOutline, UserAltOutline, WorkItemsOutline } from "@makeplane/propel/icons";
// plane package imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { LinearProgress } from "@makeplane/propel/components/linear-progress";
import { setPromiseToast, setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IModule, IUserLite } from "@plane/types";
import { Card } from "@plane/blocks/card";
import { FavoriteStar } from "@plane/blocks/common";
import { DateRangeSelect } from "@plane/blocks/property-select";
import type { DateRangeValue, WeekStart } from "@plane/blocks/property-select";
import { getDate, renderFormattedPayloadDate, generateQueryParams } from "@plane/utils";
// components
import { handleTriggerKeyDown } from "@/components/common/trigger-guard";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { ModuleQuickActions } from "@/components/modules";
import { ModuleStatusDropdown } from "@/components/modules/module-status-dropdown";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
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

type TModuleOverviewContext = {
  router: ReturnType<typeof useAppRouter>;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  moduleId: string;
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

const handleOpenModuleOverview = (e: React.MouseEvent<HTMLButtonElement>, context: TModuleOverviewContext) => {
  e.stopPropagation();
  e.preventDefault();

  const { router, pathname, searchParams, moduleId } = context;
  const query = generateQueryParams(searchParams, ["peekModule"]);
  if (searchParams.has("peekModule") && searchParams.get("peekModule") === moduleId) {
    router.push(`${pathname}?${query}`);
  } else {
    router.push(`${pathname}?${query && `${query}&`}peekModule=${moduleId}`);
  }
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

  let issueCount: string;
  if (!moduleTotalIssues) issueCount = `0 work items`;
  else if (moduleTotalIssues === moduleCompletedIssues)
    issueCount = translate("web.runtime.items_count", { count: moduleTotalIssues });
  else issueCount = `${moduleCompletedIssues}/${moduleTotalIssues} Work items`;

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

const hasDateRange = (moduleDetails: IModule) =>
  Boolean(moduleDetails.start_date) || Boolean(moduleDetails.target_date);

type TModuleCardHeaderActionsProps = {
  moduleDetails: IModule;
  isDisabled: boolean;
  onModuleDetailsChange: (payload: Partial<IModule>) => Promise<void>;
  onOpenOverview: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

const ModuleCardHeaderActions = observer(function ModuleCardHeaderActions({
  moduleDetails,
  isDisabled,
  onModuleDetailsChange,
  onOpenOverview,
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
          isDisabled={isDisabled}
          moduleDetails={moduleDetails}
          handleModuleDetailsChange={onModuleDetailsChange}
        />
      )}
      <button onClick={onOpenOverview}>
        <InfoOutline className="h-4 w-4 text-placeholder" />
      </button>
    </div>
  );
});

type TModuleCardDateRangeProps = {
  moduleDetails: IModule;
  isDisabled: boolean;
  hasDates: boolean;
  weekStartsOn: WeekStart | undefined;
  onDateRangeChange: (range: DateRangeValue) => void;
};

const ModuleCardDateRange = observer(function ModuleCardDateRange({
  moduleDetails,
  isDisabled,
  hasDates,
  weekStartsOn,
  onDateRangeChange,
}: TModuleCardDateRangeProps) {
  // Ruling 38: the whole card is a `Link`, so the trigger's click and keyboard
  // activation must not reach it.
  return (
    <div
      className="flex items-center justify-between py-0.5"
      role="presentation"
      onClick={handleEventPropagation}
      onKeyDown={handleTriggerKeyDown}
    >
      <DateRangeSelect
        variant="select-ghost-md"
        className={`h-6 w-full gap-1.5 rounded-sm border-[0.5px] border-strong text-11 text-tertiary ${
          isDisabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        value={getModuleDateRange(moduleDetails)}
        onChange={onDateRangeChange}
        placeholder={translate("web.start_date_end_date")}
        weekStartsOn={weekStartsOn}
        disabled={isDisabled}
        icon={hasDates ? undefined : <CalendarOutline aria-hidden="true" />}
      />
    </div>
  );
});

type TModuleCardLeadProps = {
  leadDetails: IUserLite;
};

const ModuleCardLead = observer(function ModuleCardLead({ leadDetails }: TModuleCardLeadProps) {
  return (
    <span className="cursor-default">
      <ButtonAvatars showTooltip={false} userIds={leadDetails?.id} />
    </span>
  );
});

export const ModuleCardItem = observer(function ModuleCardItem(props: Props) {
  const { moduleId } = props;
  // refs
  const parentRef = useRef(null);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getModuleById, addModuleToFavorites, removeModuleFromFavorites, updateModuleDetails } = useModule();
  const { getUserDetails } = useMember();
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
  const moduleLeadDetails = moduleDetails.lead_id ? getUserDetails(moduleDetails.lead_id) : undefined;

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
  const overviewContext: TModuleOverviewContext = { router, pathname, searchParams, moduleId };

  return (
    <div className="relative" data-prevent-progress>
      <Link ref={parentRef} href={`/${workspaceSlug}/projects/${moduleDetails.project_id}/modules/${moduleDetails.id}`}>
        <Card>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Tooltip label={moduleDetails.name} layout="stacked" disabled={isMobile}>
                <span className="truncate text-14 font-medium">{moduleDetails.name}</span>
              </Tooltip>
              <ModuleCardHeaderActions
                moduleDetails={moduleDetails}
                isDisabled={isDisabled}
                onModuleDetailsChange={(payload) => handleModuleDetailsChange(payload, actionContext)}
                onOpenOverview={(e) => handleOpenModuleOverview(e, overviewContext)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-secondary">
                <WorkItemsOutline className="h-4 w-4 text-tertiary" />
                <span className="text-11 text-tertiary">{issueCount ?? "0 Work item"}</span>
              </div>
              {moduleLeadDetails ? (
                <ModuleCardLead leadDetails={moduleLeadDetails} />
              ) : (
                <Tooltip label={translate("web.no_lead")}>
                  <UserAltOutline className="mx-1 h-4 w-4 text-tertiary" />
                </Tooltip>
              )}
            </div>
            <LinearProgress
              value={progressValue}
              size="md"
              variant="brand"
              showValue={false}
              aria-label={translate("web.module_progress")}
            />
            <ModuleCardDateRange
              moduleDetails={moduleDetails}
              isDisabled={isDisabled}
              hasDates={hasDateRange(moduleDetails)}
              weekStartsOn={userProfile?.start_of_the_week}
              onDateRangeChange={(range) => {
                void handleModuleDetailsChange(getDateRangePayload(range), actionContext);
              }}
            />
          </div>
        </Card>
      </Link>
      <div className="absolute right-4 bottom-[18px] flex items-center gap-1.5">
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
  );
});
