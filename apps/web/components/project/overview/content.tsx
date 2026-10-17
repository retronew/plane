/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { EmojiPicker, ProjectLogo, getIconBackgroundStyle } from "@plane/blocks/emoji-icon-picker";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { getFileURL } from "@plane/utils";
import { CoverImage } from "@/components/common/cover-image";
import { CoverImageUploadButton } from "@/components/core/cover-image-upload-button";
import { useProject } from "@/hooks/store/use-project";
import { ProjectOverviewDescription } from "./description";
import { ProjectOverviewProgress } from "./progress";
import { ProjectOverviewResources } from "./resources";
import { useRefreshProjectActivities } from "./use-refresh-activities";

export const ProjectOverviewContent = observer(function ProjectOverviewContent({
  project,
  workspaceSlug,
  disabled,
}: {
  project: IProject;
  workspaceSlug: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { updateProject } = useProject();
  const refreshActivities = useRefreshProjectActivities(workspaceSlug, project.id);
  const [iconOpen, setIconOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (payload: Partial<IProject>) => {
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await updateProject(workspaceSlug, project.id, payload);
      void refreshActivities();
    } catch (error) {
      console.error("Failed to save project overview", error);
      setToast({ type: "error", title: t("toast.error"), message: t("web.configuration_save_error") });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <section className="min-w-0 flex-1 lg:h-full lg:overflow-y-auto" aria-label={t("common.overview")}>
      <div className="relative h-[118px] w-full">
        <CoverImage
          src={project.cover_image_url || project.cover_image}
          alt={t("web.project_cover_image")}
          className="size-full"
        />
        {!disabled && (
          <div className="absolute top-4 right-4">
            <CoverImageUploadButton
              label={t("change_cover")}
              projectId={project.id}
              disabled={saving}
              onChange={(url) => void save({ cover_image: getFileURL(url) || url, cover_image_url: url })}
            />
          </div>
        )}
      </div>
      <div className="relative px-5 pb-10 sm:px-10">
        <div className="relative -mt-5 mb-7 w-fit">
          <EmojiPicker
            isOpen={iconOpen}
            handleToggle={setIconOpen}
            iconType="material"
            disabled={disabled || saving}
            buttonClassName="grid size-10 place-items-center rounded-md bg-layer-1"
            label={
              <span
                className="grid size-10 place-items-center rounded-md"
                style={getIconBackgroundStyle(project.logo_props)}
              >
                <ProjectLogo logo={project.logo_props} size={24} background={false} />
              </span>
            }
            defaultOpen={project.logo_props?.in_use === "icon" ? "icon" : "emoji"}
            defaultIconColor={project.logo_props?.icon?.color}
            defaultIconBackground={project.logo_props?.icon?.background_color}
            onChange={(value) => {
              setIconOpen(false);
              void save({
                logo_props:
                  value.type === "emoji"
                    ? { in_use: "emoji", emoji: { value: value.value } }
                    : { in_use: "icon", icon: value.value },
              });
            }}
            onIconBackgroundChange={(background) => {
              if (project.logo_props?.in_use === "icon")
                void save({
                  logo_props: {
                    ...project.logo_props,
                    icon: { ...project.logo_props.icon, background_color: background },
                  },
                });
            }}
          />
        </div>
        <h1 className="mb-5 text-20 font-semibold break-words text-primary">{project.name}</h1>
        <ProjectOverviewDescription
          key={project.id}
          project={project}
          workspaceSlug={workspaceSlug}
          disabled={disabled}
        />
        <div className="mt-6">
          <ProjectOverviewResources project={project} workspaceSlug={workspaceSlug}>
            <ProjectOverviewProgress workspaceSlug={workspaceSlug} projectId={project.id} />
          </ProjectOverviewResources>
        </div>
      </div>
    </section>
  );
});
