import { ProjectCategoryFields } from "@/components/settings/workspace/configuration/project-fields";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TemplatePicker } from "@/components/settings/workspace/configuration/template-picker";
import type { TemplateConfiguration } from "@/services/workspace-configuration.service";
import { projectIdentifierSanitizer } from "@plane/utils";
import { useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { FormProvider, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
// components
import ProjectCommonAttributes, { ProjectCreateDescription } from "@/components/project/create/common-attributes";
import ProjectCreateHeader from "@/components/project/create/header";
import ProjectCreateButtons from "@/components/project/create/project-create-buttons";
// hooks
import { getCoverImagePayload } from "@/helpers/cover-image.helper";
import { useProject } from "@/hooks/store/use-project";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web types
import type { TProject } from "@plane/types";
import { ProjectAttributes } from "./attributes";
import { getProjectFormValues } from "./utils";

export type TCreateProjectFormProps = {
  isOpen?: boolean;
  setToFavorite?: boolean;
  workspaceSlug: string;
  onClose: () => void;
  handleNextStep: (projectId: string) => void;
  data?: Partial<TProject>;
  templateId?: string;
  updateCoverImageStatus: (projectId: string, coverImage: string) => Promise<void>;
};

export const CreateProjectForm = observer(function CreateProjectForm(props: TCreateProjectFormProps) {
  const { isOpen = true, setToFavorite, workspaceSlug, data, onClose, handleNextStep, updateCoverImageStatus } = props;
  const session = useRef<object | null>(null);
  useLayoutEffect(() => {
    session.current = isOpen ? {} : null;
    return () => {
      session.current = null;
    };
  }, [isOpen, workspaceSlug]);
  // store
  const { t } = useTranslation();
  const { addProjectToFavorites, createProject, updateProject } = useProject();
  // states
  const [templateConfiguration, setTemplateConfiguration] = useState<TemplateConfiguration | null>(null);
  const [shouldAutoSyncIdentifier, setShouldAutoSyncIdentifier] = useState(true);
  // form info
  const methods = useForm<TProject>({
    defaultValues: { ...getProjectFormValues(), ...data },
    reValidateMode: "onChange",
  });
  const { handleSubmit, setValue, watch } = methods;
  const { isMobile } = usePlatformOS();
  const handleAddToFavorites = (projectId: string) => {
    if (!workspaceSlug) return;

    addProjectToFavorites(workspaceSlug.toString(), projectId).catch(() => {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("failed_to_remove_project_from_favorites"),
      });
    });
  };

  const onSubmit = async (formData: Partial<TProject>) => {
    const submittedSession = session.current;
    const isCurrentSession = () => submittedSession !== null && session.current === submittedSession;
    if (!isCurrentSession()) return;
    // Upper case identifier
    formData.identifier = formData.identifier?.toUpperCase();
    const coverImage = formData.cover_image_url;
    Object.assign(formData, getCoverImagePayload(undefined, coverImage));

    return createProject(workspaceSlug.toString(), {
      ...formData,
      ...(templateConfiguration
        ? { template_configuration: templateConfiguration, intake_view: templateConfiguration.intake_view }
        : {}),
    })
      .then(async (res) => {
        if (!isCurrentSession()) return;
        if (coverImage) {
          await updateCoverImageStatus(res.id, coverImage);
          if (!isCurrentSession()) return;
          await updateProject(workspaceSlug.toString(), res.id, { cover_image_url: coverImage });
        }
        if (!isCurrentSession()) return;
        setToast({
          type: "success",
          title: t("success"),
          message: t("project_created_successfully"),
        });

        if (setToFavorite) {
          handleAddToFavorites(res.id);
        }
        return handleNextStep(res.id);
      })
      .catch((err) => {
        if (!isCurrentSession()) return;
        try {
          // Handle the new error format where codes are nested in arrays under field names
          const errorData = err?.data ?? {};

          const nameError = errorData.name?.includes("PROJECT_NAME_ALREADY_EXIST");
          const identifierError = errorData?.identifier?.includes("PROJECT_IDENTIFIER_ALREADY_EXIST");
          const nameSpecialCharError = errorData?.name?.includes("PROJECT_NAME_CANNOT_CONTAIN_SPECIAL_CHARACTERS");

          if (nameError || identifierError || nameSpecialCharError) {
            if (nameError) {
              setToast({
                type: "error",
                title: t("toast.error"),
                message: t("project_name_already_taken"),
              });
            }

            if (identifierError) {
              setToast({
                type: "error",
                title: t("toast.error"),
                message: t("project_identifier_already_taken"),
              });
            }

            if (nameSpecialCharError) {
              setToast({
                type: "error",
                title: t("toast.error"),
                message: t("project_name_cannot_contain_special_characters"),
              });
            }
          } else {
            setToast({
              type: "error",
              title: t("toast.error"),
              message: t("something_went_wrong"),
            });
          }
        } catch (error) {
          // Fallback error handling if the error processing fails
          console.error("Error processing API error:", error);
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("something_went_wrong"),
          });
        }
      });
  };

  const handleClose = () => {
    session.current = null;
    onClose();
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit, (errors) => {
          const message = errors.name?.message ?? errors.identifier?.message;
          setToast({
            type: "error",
            title: t("toast.error"),
            message: message ?? t("something_went_wrong"),
          });
        })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col px-2 pt-1">
          <ProjectCreateHeader
            handleClose={handleClose}
            isMobile={isMobile}
            templatePicker={
              <TemplatePicker
                workspaceSlug={workspaceSlug}
                kind="project"
                variant="page"
                disabled={methods.formState.isSubmitting}
                onApply={(template) => {
                  const config = template.configuration;
                  const name = template.title || template.name;
                  setValue("name", name, { shouldDirty: true });
                  if (shouldAutoSyncIdentifier)
                    setValue("identifier", projectIdentifierSanitizer(name).substring(0, 10), { shouldDirty: true });
                  setValue("priority", template.priority ?? "none", { shouldDirty: true });
                  setValue("description", config.description ?? "", { shouldDirty: true });
                  setValue("description_html", null, { shouldDirty: true });
                  setValue("description_text", null, { shouldDirty: true });
                  setValue("network", config.network ?? 2, { shouldDirty: true });
                  setValue("project_lead", config.project_lead ?? null, { shouldDirty: true });
                  for (const field of ["cycle_view", "module_view", "page_view", "issue_views_view"] as const)
                    if (config[field] !== undefined) setValue(field, config[field], { shouldDirty: true });
                  setTemplateConfiguration(config);
                }}
              />
            }
          />
          <div className="min-h-0 overflow-y-auto px-3 pt-2 pb-3">
            <div className="space-y-3">
              <ProjectCommonAttributes
                setValue={setValue}
                isMobile={isMobile}
                shouldAutoSyncIdentifier={shouldAutoSyncIdentifier}
                setShouldAutoSyncIdentifier={setShouldAutoSyncIdentifier}
              />
              <div className="flex flex-wrap items-center gap-2">
                <ProjectCategoryFields
                  compact
                  workspaceSlug={workspaceSlug}
                  status={watch("status")}
                  labels={watch("labels")}
                  onStatus={(id) => setValue("status", id)}
                  onLabels={(ids) => setValue("labels", ids)}
                  renderFields={({ status, labels }) => (
                    <ProjectAttributes isMobile={isMobile} status={status} labels={labels} />
                  )}
                />
              </div>
              <ProjectCreateDescription isMobile={isMobile} workspaceSlug={workspaceSlug} />
            </div>
          </div>
        </div>
        <ProjectCreateButtons handleClose={handleClose} />
      </form>
    </FormProvider>
  );
});
