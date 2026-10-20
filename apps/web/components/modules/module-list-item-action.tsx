/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CalendarOutline } from "@makeplane/propel/icons";
// Plane imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation, translate } from "@plane/i18n";
import { setPromiseToast, setToast } from "@plane/blocks/toast";
import type { IModule } from "@plane/types";
import { FavoriteStar } from "@plane/blocks/common";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { formatCompactDateRange, renderFormattedPayloadDate, getDate } from "@plane/utils";
// components
import { ModuleQuickActions } from "@/components/modules";
import { ModuleStatusDropdown } from "@/components/modules/module-status-dropdown";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useUserPermissions, useUserProfile } from "@/hooks/store/user";
import { MemberSelect } from "@/components/dropdowns/member/member-select";

type Props = {
  moduleId: string;
  moduleDetails: IModule;
  parentRef: React.RefObject<HTMLDivElement | null>;
};

export const ModuleListItemAction = observer(function ModuleListItemAction(props: Props) {
  const { moduleId, moduleDetails, parentRef } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  //   store hooks
  const { allowPermissions } = useUserPermissions();
  const { addModuleToFavorites, removeModuleFromFavorites, updateModuleDetails } = useModule();
  const { data: userProfile } = useUserProfile();

  const { t } = useTranslation();

  // local storage
  const { setValue: toggleFavoriteMenu, storedValue } = useLocalStorage<boolean>(IS_FAVORITE_MENU_OPEN, false);
  // derived values

  const moduleStatus = MODULE_STATUS.find((status) => status.value === moduleDetails.status);
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const isDisabled = !isEditingAllowed || !!moduleDetails?.archived_at;

  // handlers
  const handleAddToFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const addToFavoritePromise = addModuleToFavorites(workspaceSlug.toString(), projectId.toString(), moduleId).then(
      () => {
        // open favorites menu if closed
        if (!storedValue) toggleFavoriteMenu(true);
        return undefined;
      }
    );

    setPromiseToast(addToFavoritePromise, {
      loading: t("web.adding_module_to_favorites"),
      success: {
        title: t("toast.success"),
        message: () => "Module added to favorites.",
      },
      error: {
        title: t("toast.error"),
        message: () => "Couldn't add the module to favorites. Please try again.",
      },
    });
  };

  const handleRemoveFromFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const removeFromFavoritePromise = removeModuleFromFavorites(
      workspaceSlug.toString(),
      projectId.toString(),
      moduleId
    );

    setPromiseToast(removeFromFavoritePromise, {
      loading: t("web.removing_module_from_favorites"),
      success: {
        title: t("toast.success"),
        message: () => "Module removed from favorites.",
      },
      error: {
        title: t("toast.error"),
        message: () => "Couldn't remove the module from favorites. Please try again.",
      },
    });
  };

  const handleModuleDetailsChange = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;

    await updateModuleDetails(workspaceSlug.toString(), projectId.toString(), moduleId, payload)
      .then(() => {
        setToast({
          type: "success",
          title: t("toast.success"),
          message: t("web.module_updated_successfully"),
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: "error",
          title: t("toast.error"),
          message: err?.detail ?? t("web.module_could_not_be_updated_please_try_again"),
        });
      });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="flex h-7 w-auto shrink-0 items-center">
        <DateRangeSelect
          variant="pill-sm"
          className={`min-w-0 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          value={{
            from: getDate(moduleDetails.start_date) ?? null,
            to: getDate(moduleDetails.target_date) ?? null,
          }}
          onChange={(range) => {
            void handleModuleDetailsChange({
              start_date: range.from ? renderFormattedPayloadDate(range.from) : null,
              target_date: range.to ? renderFormattedPayloadDate(range.to) : null,
            });
          }}
          formatLabel={formatCompactDateRange}
          mergeDates
          placeholder={translate("web.runtime.date_range_placeholder")}
          weekStartsOn={userProfile?.start_of_the_week}
          disabled={isDisabled}
          icon={<CalendarOutline aria-hidden="true" />}
        />
      </div>

      <div className="flex h-7 w-auto shrink-0 items-center">
        {moduleStatus && (
          <ModuleStatusDropdown
            variant="pill-sm"
            isDisabled={isDisabled}
            moduleDetails={moduleDetails}
            handleModuleDetailsChange={handleModuleDetailsChange}
          />
        )}
      </div>
      <div className="flex h-7 min-w-0 shrink-0 items-center">
        <MemberSelect
          variant="pill-sm"
          value={moduleDetails.lead_id}
          projectId={projectId?.toString()}
          disabled={isDisabled}
          placeholder={t("web.no_lead")}
          clearable
          onChange={(lead) => {
            void handleModuleDetailsChange({ lead_id: lead || null });
          }}
        />
      </div>
      <div className="flex h-7 w-auto shrink-0 items-center justify-center">
        {isEditingAllowed && !moduleDetails.archived_at && (
          <FavoriteStar
            buttonClassName="h-7 w-7"
            onClick={(e) => {
              if (moduleDetails.is_favorite) handleRemoveFromFavorites(e);
              else handleAddToFavorites(e);
            }}
            selected={moduleDetails.is_favorite}
          />
        )}
      </div>
      {workspaceSlug && projectId && (
        <div className="hidden h-7 items-center md:flex">
          <ModuleQuickActions
            parentRef={parentRef}
            moduleId={moduleId}
            projectId={projectId.toString()}
            workspaceSlug={workspaceSlug.toString()}
          />
        </div>
      )}
    </div>
  );
});
