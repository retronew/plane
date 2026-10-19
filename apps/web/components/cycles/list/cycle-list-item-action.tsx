/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MouseEvent } from "react";
import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { CalendarOutline, MembersOutline, TransferWorkItemOutline, WorkItemsOutline } from "@makeplane/propel/icons";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import type { TTranslationStore } from "@plane/i18n";
import { useTranslation, translate } from "@plane/i18n";
import { Avatar } from "@makeplane/propel/components/avatar";
import { AvatarGroup } from "@makeplane/propel/components/avatar-group";
import { setPromiseToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { ICycle, IUserLite, TCycleGroups } from "@plane/types";
import { FavoriteStar } from "@plane/blocks/common";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { getDate, getFileURL, generateQueryParams } from "@plane/utils";
// components
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { MergedDateDisplay } from "@/components/dropdowns/merged-date";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useTimeZoneConverter } from "@/hooks/use-timezone-converter";
// local imports
import { CycleQuickActions } from "../quick-actions";
import { TransferIssuesModal } from "../transfer-issues-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleDetails: ICycle;
  parentRef: React.RefObject<HTMLDivElement | null>;
  isActive?: boolean;
};

type TTranslator = TTranslationStore["t"];
type TTimeZoneConverter = ReturnType<typeof useTimeZoneConverter>;
type TMemberDetailsGetter = ReturnType<typeof useMember>["getUserDetails"];
type TAddCycleToFavorites = (workspaceSlug: string, projectId: string, cycleId: string) => Promise<unknown>;
type TRemoveCycleFromFavorites = (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;

const getCycleStatus = (status: TCycleGroups | undefined): TCycleGroups =>
  status ? (status.toLocaleLowerCase() as TCycleGroups) : "draft";

const getShowIssueCount = (cycleStatus: TCycleGroups) => cycleStatus === "draft" || cycleStatus === "upcoming";

const getTransferableIssuesCount = (cycleDetails: ICycle | undefined) =>
  cycleDetails ? cycleDetails.total_issues - (cycleDetails.cancelled_issues + cycleDetails.completed_issues) : 0;

const getShowTransferIssues = (
  routerProjectId: string | string[] | undefined,
  transferableIssuesCount: number,
  cycleStatus: TCycleGroups
) => Boolean(routerProjectId) && transferableIssuesCount > 0 && cycleStatus === "completed";

const getCycleDetailsPath = (pathname: string, searchParams: ReturnType<typeof useSearchParams>, cycleId: string) => {
  const query = generateQueryParams(searchParams, ["peekCycle"]);
  return `${pathname}?${query ? `${query}&` : ""}peekCycle=${cycleId}`;
};

const addCycleToFavoritesWithToast = ({
  workspaceSlug,
  projectId,
  cycleId,
  isFavoriteMenuOpen,
  toggleFavoriteMenu,
  addCycleToFavorites,
  t,
}: {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  isFavoriteMenuOpen: boolean | null;
  toggleFavoriteMenu: (value: boolean) => void;
  addCycleToFavorites: TAddCycleToFavorites;
  t: TTranslator;
}) => {
  if (!workspaceSlug || !projectId) return;

  const addToFavoritePromise = addCycleToFavorites(workspaceSlug?.toString(), projectId.toString(), cycleId).then(
    // oxlint-disable-next-line promise/always-return
    () => {
      if (!isFavoriteMenuOpen) toggleFavoriteMenu(true);
    }
  );

  setPromiseToast(addToFavoritePromise, {
    loading: t("project_cycles.action.favorite.loading"),
    success: {
      title: t("project_cycles.action.favorite.success.title"),
      message: () => t("project_cycles.action.favorite.success.description"),
    },
    error: {
      title: t("project_cycles.action.favorite.failed.title"),
      message: () => t("project_cycles.action.favorite.failed.description"),
    },
  });
};

const removeCycleFromFavoritesWithToast = ({
  workspaceSlug,
  projectId,
  cycleId,
  removeCycleFromFavorites,
  t,
}: {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  removeCycleFromFavorites: TRemoveCycleFromFavorites;
  t: TTranslator;
}) => {
  if (!workspaceSlug || !projectId) return;

  const removeFromFavoritePromise = removeCycleFromFavorites(workspaceSlug?.toString(), projectId.toString(), cycleId);

  setPromiseToast(removeFromFavoritePromise, {
    loading: t("project_cycles.action.unfavorite.loading"),
    success: {
      title: t("project_cycles.action.unfavorite.success.title"),
      message: () => t("project_cycles.action.unfavorite.success.description"),
    },
    error: {
      title: t("project_cycles.action.unfavorite.failed.title"),
      message: () => t("project_cycles.action.unfavorite.failed.description"),
    },
  });
};

const handleFavoriteToggle = (
  event: MouseEvent<HTMLButtonElement>,
  {
    isFavorite,
    onAdd,
    onRemove,
  }: {
    isFavorite: boolean;
    onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
    onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  }
) => {
  event.preventDefault();
  event.stopPropagation();

  if (isFavorite) onRemove(event);
  else onAdd(event);
};

function CycleIssueCount({ show, totalIssues }: { show: boolean; totalIssues: number }) {
  if (!show) return null;

  return (
    <div className="flex items-center gap-1">
      <WorkItemsOutline className="h-4 w-4 text-tertiary" />
      <span className="text-11 text-tertiary">{totalIssues}</span>
    </div>
  );
}

function TransferIssuesButton({
  show,
  transferableIssuesCount,
  onOpen,
  t,
}: {
  show: boolean;
  transferableIssuesCount: number;
  onOpen: () => void;
  t: TTranslator;
}) {
  if (!show) return null;

  return (
    <button
      type="button"
      className="flex h-6 cursor-pointer items-center gap-1 px-2 text-accent-secondary"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
    >
      <TransferWorkItemOutline className="w-4 fill-accent-primary" />
      <span>{t("project_cycles.transfer_work_items", { count: transferableIssuesCount })}</span>
    </button>
  );
}

const CycleActiveMeta = observer(function CycleActiveMeta({
  cycleDetails,
  projectUTCOffset,
  cycleOwnerDetails,
  renderFormattedDateInUserTimezone,
  isProjectTimeZoneDifferent,
}: {
  cycleDetails: ICycle;
  projectUTCOffset: string | undefined;
  cycleOwnerDetails: IUserLite | undefined;
  renderFormattedDateInUserTimezone: TTimeZoneConverter["renderFormattedDateInUserTimezone"];
  isProjectTimeZoneDifferent: TTimeZoneConverter["isProjectTimeZoneDifferent"];
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Duration */}
        <Tooltip
          label={translate("web.runtime.timezone_range", {
            start: renderFormattedDateInUserTimezone(cycleDetails.start_date ?? "") ?? "",
            end: renderFormattedDateInUserTimezone(cycleDetails.end_date ?? "") ?? "",
          })}
          layout="stacked"
          disabled={!isProjectTimeZoneDifferent()}
        >
          <div className="flex items-center gap-1 text-11 font-medium text-tertiary">
            <CalendarOutline className="my-auto h-3 w-3 flex-shrink-0" />
            <MergedDateDisplay compact startDate={cycleDetails.start_date} endDate={cycleDetails.end_date} />
          </div>
        </Tooltip>
        {projectUTCOffset && (
          <span className="cursor-default rounded-md bg-layer-1 px-2 py-1 text-11 text-tertiary">
            {projectUTCOffset}
          </span>
        )}
        {/* created by */}
        {cycleOwnerDetails && <ButtonAvatars showTooltip={false} userIds={cycleOwnerDetails?.id} />}
      </div>
    </>
  );
});

const CycleOwnerAvatar = observer(function CycleOwnerAvatar({
  owner,
  isActive,
}: {
  owner: IUserLite | undefined;
  isActive: boolean;
}) {
  if (!owner || isActive) return null;

  return <ButtonAvatars showTooltip={false} userIds={owner.id} />;
});

const CycleMembers = observer(function CycleMembers({
  isActive,
  cycleDetails,
  isMobile,
  getUserDetails,
}: {
  isActive: boolean;
  cycleDetails: ICycle;
  isMobile: boolean;
  getUserDetails: TMemberDetailsGetter;
}) {
  if (isActive) return null;

  return (
    <Tooltip
      label={translate("web.runtime.members_count", { count: cycleDetails.assignee_ids?.length ?? 0 })}
      layout="stacked"
      disabled={isMobile}
    >
      <div className="flex w-min cursor-default items-center justify-center">
        {cycleDetails.assignee_ids && cycleDetails.assignee_ids?.length > 0 ? (
          <AvatarGroup size="xs" max={2}>
            {cycleDetails.assignee_ids?.map((assignee_id) => {
              const member = getUserDetails(assignee_id);
              return <Avatar key={assignee_id} alt={member?.display_name} src={getFileURL(member?.avatar_url ?? "")} />;
            })}
          </AvatarGroup>
        ) : (
          <MembersOutline className="h-4 w-4 text-tertiary" />
        )}
      </div>
    </Tooltip>
  );
});

function CycleFavoriteStar({
  isEditingAllowed,
  isArchived,
  isFavorite,
  onClick,
}: {
  isEditingAllowed: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (!isEditingAllowed || isArchived) return null;

  return <FavoriteStar onClick={onClick} selected={isFavorite} />;
}

export const CycleListItemAction = observer(function CycleListItemAction(props: Props) {
  const { workspaceSlug, projectId, cycleId, cycleDetails, parentRef, isActive = false } = props;
  // router
  const { projectId: routerProjectId } = useParams();
  //states
  const [transferIssuesModal, setTransferIssuesModal] = useState(false);
  // hooks
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const { isProjectTimeZoneDifferent, getProjectUTCOffset, renderFormattedDateInUserTimezone } =
    useTimeZoneConverter(projectId);
  // router
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // store hooks
  const { addCycleToFavorites, removeCycleFromFavorites } = useCycle();
  const { allowPermissions } = useUserPermissions();
  const { data: userProfile } = useUserProfile();

  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  const { getUserDetails } = useMember();

  // derived values
  const cycleStatus = getCycleStatus(cycleDetails.status);

  const showIssueCount = useMemo(() => getShowIssueCount(cycleStatus), [cycleStatus]);

  const transferableIssuesCount = getTransferableIssuesCount(cycleDetails);

  const showTransferIssues = getShowTransferIssues(routerProjectId, transferableIssuesCount, cycleStatus);

  const projectUTCOffset = getProjectUTCOffset();

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  // handlers
  const handleAddToFavorites = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    addCycleToFavoritesWithToast({
      workspaceSlug,
      projectId,
      cycleId,
      isFavoriteMenuOpen,
      toggleFavoriteMenu,
      addCycleToFavorites,
      t,
    });
  };

  const handleRemoveFromFavorites = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    removeCycleFromFavoritesWithToast({
      workspaceSlug,
      projectId,
      cycleId,
      removeCycleFromFavorites,
      t,
    });
  };

  const cycleOwnerDetails = getUserDetails(cycleDetails.owned_by_id);

  return (
    <>
      <TransferIssuesModal
        handleClose={() => setTransferIssuesModal(false)}
        isOpen={transferIssuesModal}
        cycleId={cycleId.toString()}
      />
      <CycleIssueCount show={showIssueCount} totalIssues={cycleDetails.total_issues} />
      <TransferIssuesButton
        show={showTransferIssues}
        transferableIssuesCount={transferableIssuesCount}
        onOpen={() => setTransferIssuesModal(true)}
        t={t}
      />
      {isActive ? (
        <CycleActiveMeta
          cycleDetails={cycleDetails}
          projectUTCOffset={projectUTCOffset}
          cycleOwnerDetails={cycleOwnerDetails}
          renderFormattedDateInUserTimezone={renderFormattedDateInUserTimezone}
          isProjectTimeZoneDifferent={isProjectTimeZoneDifferent}
        />
      ) : (
        cycleDetails.start_date && (
          <>
            <DateRangeSelect
              variant="select-ghost-md"
              className="flex h-6 w-full cursor-auto items-center gap-1.5 rounded-sm p-0 text-11 text-tertiary [&>div]:hover:bg-transparent"
              minDate={new Date()}
              value={{
                from: getDate(cycleDetails.start_date) ?? null,
                to: getDate(cycleDetails.end_date) ?? null,
              }}
              onChange={() => {}}
              placeholder={translate("web.runtime.date_range_placeholder")}
              showTooltip={isProjectTimeZoneDifferent()}
              tooltipHeading={t("project_cycles.in_your_timezone")}
              tooltipContent={`${renderFormattedDateInUserTimezone(
                cycleDetails.start_date ?? ""
              )} → ${renderFormattedDateInUserTimezone(cycleDetails.end_date ?? "")}`}
              mergeDates
              disabled
              weekStartsOn={userProfile?.start_of_the_week}
              icon={<CalendarOutline />}
            />
          </>
        )
      )}
      {/* created by */}
      <CycleOwnerAvatar owner={cycleOwnerDetails} isActive={isActive} />
      <CycleMembers
        isActive={isActive}
        cycleDetails={cycleDetails}
        isMobile={isMobile}
        getUserDetails={getUserDetails}
      />
      <CycleFavoriteStar
        isEditingAllowed={isEditingAllowed}
        isArchived={!!cycleDetails.archived_at}
        isFavorite={!!cycleDetails.is_favorite}
        onClick={(e) =>
          handleFavoriteToggle(e, {
            isFavorite: !!cycleDetails.is_favorite,
            onAdd: handleAddToFavorites,
            onRemove: handleRemoveFromFavorites,
          })
        }
      />
      <div className="hidden md:block">
        <CycleQuickActions
          parentRef={parentRef}
          cycleId={cycleId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          onOpenDetails={() => {
            router.push(getCycleDetailsPath(pathname, searchParams, cycleId));
          }}
        />
      </div>
    </>
  );
});
