/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { IProject, IUserLite, IWorkspace } from "@plane/types";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import { Switch } from "@makeplane/propel/components/switch";
import { Loader } from "@plane/blocks/skeleton";
// constants
import { PROJECT_DETAILS } from "@plane/constants";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";

const defaultValues: Partial<IProject> = {
  project_lead: null,
  default_assignee: null,
};

type TDefaultSettingItemProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function DefaultSettingItem({ title, description, children }: TDefaultSettingItemProps) {
  return (
    <div>
      <SettingsBoxedControlItem
        className="rounded-none border-0 bg-transparent"
        title={title}
        description={description}
        control={<div className="w-44 sm:w-52">{children}</div>}
      />
    </div>
  );
}

type TProjectSettingsMemberDefaultsProps = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectSettingsMemberDefaults = observer(function ProjectSettingsMemberDefaults(
  props: TProjectSettingsMemberDefaultsProps
) {
  const { workspaceSlug, projectId } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { allowPermissions } = useUserPermissions();

  const { currentProjectDetails, fetchProjectDetails, updateProject } = useProject();
  // derived values
  const isAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    currentProjectDetails?.id
  );
  // form info
  const { reset, control } = useForm<IProject>({ defaultValues });
  // fetching user members
  useSWR(
    workspaceSlug && projectId ? PROJECT_DETAILS(workspaceSlug, projectId) : null,
    workspaceSlug && projectId ? () => fetchProjectDetails(workspaceSlug, projectId) : null
  );

  useEffect(() => {
    if (!currentProjectDetails) return;

    reset({
      ...currentProjectDetails,
      default_assignee:
        (currentProjectDetails.default_assignee as IUserLite)?.id ?? currentProjectDetails.default_assignee,
      project_lead: (currentProjectDetails.project_lead as IUserLite)?.id ?? currentProjectDetails.project_lead,
      workspace: (currentProjectDetails.workspace as IWorkspace).id,
    });
  }, [currentProjectDetails, reset]);

  const submitChanges = async (formData: Partial<IProject>) => {
    if (!workspaceSlug || !projectId) return;

    reset({
      ...currentProjectDetails,
      default_assignee:
        (currentProjectDetails?.default_assignee as IUserLite)?.id ?? currentProjectDetails?.default_assignee,
      project_lead: (currentProjectDetails?.project_lead as IUserLite)?.id ?? currentProjectDetails?.project_lead,
      ...formData,
    });

    await updateProject(workspaceSlug, projectId, {
      default_assignee:
        formData.default_assignee === "none"
          ? null
          : (formData.default_assignee ?? currentProjectDetails?.default_assignee),
      project_lead:
        formData.project_lead === "none" ? null : (formData.project_lead ?? currentProjectDetails?.project_lead),
    })
      .then(() => {
        setToast({
          title: t("success"),
          type: "success",
          message: t("project_settings.general.toast.success"),
        });
        return undefined;
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const toggleGuestViewAllIssues = async (value: boolean) => {
    if (!workspaceSlug || !projectId) return;

    updateProject(workspaceSlug, projectId, {
      guest_view_all_features: value,
    })
      .then(() => {
        setToast({
          title: t("success"),
          type: "success",
          message: t("project_settings.general.toast.success"),
        });
        return undefined;
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return (
    <div className="mt-6 mb-10 flex flex-col divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-layer-2">
      <DefaultSettingItem title={t("web.project_lead")} description={t("web.select_the_project_lead_for_the_project")}>
        {currentProjectDetails ? (
          <Controller
            control={control}
            name="project_lead"
            render={({ field: { value } }) => (
              <div className="relative">
                <div className="min-w-0 flex-1">
                  <MemberSelect
                    value={value as string | null}
                    onChange={(val: string) => {
                      void submitChanges({ project_lead: val || "none" });
                    }}
                    variant="select-md"
                    className={value && isAdmin ? "pr-8" : undefined}
                    hideChevron={!!value && isAdmin}
                    projectId={projectId}
                    disabled={!isAdmin}
                    placeholder={t("web.select_project_lead")}
                  />
                </div>
                {value && isAdmin && (
                  <span className="absolute inset-y-0 right-1 flex items-center">
                    <IconButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      aria-label={`${t("common.clear")} ${t("web.project_lead")}`}
                      icon={<CloseOutline className="size-3" />}
                      onClick={() => void submitChanges({ project_lead: "none" })}
                    />
                  </span>
                )}
              </div>
            )}
          />
        ) : (
          <Loader className="h-9 w-full">
            <Loader.Item width="100%" height="100%" />
          </Loader>
        )}
      </DefaultSettingItem>
      <DefaultSettingItem
        title={t("web.default_assignee")}
        description={t("web.select_the_default_assignee_for_the_project")}
      >
        {currentProjectDetails ? (
          <Controller
            control={control}
            name="default_assignee"
            render={({ field: { value } }) => (
              <div className="relative">
                <div className="min-w-0 flex-1">
                  <MemberSelect
                    value={value as string | null}
                    onChange={(val: string) => {
                      void submitChanges({ default_assignee: val || "none" });
                    }}
                    variant="select-md"
                    className={value && isAdmin ? "pr-8" : undefined}
                    hideChevron={!!value && isAdmin}
                    projectId={projectId}
                    disabled={!isAdmin}
                    placeholder={t("web.select_default_assignee")}
                  />
                </div>
                {value && isAdmin && (
                  <span className="absolute inset-y-0 right-1 flex items-center">
                    <IconButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      aria-label={`${t("common.clear")} ${t("web.default_assignee")}`}
                      icon={<CloseOutline className="size-3" />}
                      onClick={() => void submitChanges({ default_assignee: "none" })}
                    />
                  </span>
                )}
              </div>
            )}
          />
        ) : (
          <Loader className="h-9 w-full">
            <Loader.Item width="100%" height="100%" />
          </Loader>
        )}
      </DefaultSettingItem>
      {currentProjectDetails && (
        <DefaultSettingItem
          title={t("web.guest_access")}
          description={t("web.this_will_allow_guests_to_have_view_access_to_all_the_projec")}
        >
          <div className="flex items-center justify-end">
            <Switch
              size="md"
              checked={!!currentProjectDetails?.guest_view_all_features}
              onCheckedChange={toggleGuestViewAllIssues}
              disabled={!isAdmin}
              aria-label={t("web.guest_access")}
            />
          </div>
        </DefaultSettingItem>
      )}
    </div>
  );
});
