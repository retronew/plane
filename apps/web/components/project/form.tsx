/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectCategoryFields } from "@/components/settings/workspace/configuration/project-fields";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InfoOutline, LockOutline } from "@makeplane/propel/icons";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import type { TNetworkChoice } from "@plane/constants";
import { NETWORK_CHOICES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { EmojiPicker, Logo, getIconBackgroundStyle } from "@plane/blocks/emoji-icon-picker";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IProject, IWorkspace } from "@plane/types";
import { Select } from "@plane/blocks/select";
import { renderFormattedDate } from "@plane/utils";
import { CoverImage } from "@/components/common/cover-image";
import { CoverImageUploadButton } from "@/components/core/cover-image-upload-button";
import { TimezoneSelect } from "@/components/global";
// helpers
import { getCoverImagePayload } from "@/helpers/cover-image.helper";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { ProjectService } from "@/services/project";
// local imports
import { ProjectNetworkIcon } from "./project-network-icon";

export interface IProjectDetailsForm {
  project: IProject;
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
}
const projectService = new ProjectService();

const renderNetworkOptionIcon = (network: TNetworkChoice) => (
  <ProjectNetworkIcon iconKey={network.iconKey} className="mt-0.5 size-4 shrink-0" />
);

const renderNetworkTriggerIcon = (networks: TNetworkChoice[]) =>
  networks[0] ? <ProjectNetworkIcon iconKey={networks[0].iconKey} className="h-3.5 w-3.5" /> : undefined;

export function ProjectDetailsForm(props: IProjectDetailsForm) {
  const { project, workspaceSlug, projectId, isAdmin } = props;
  const { t } = useTranslation();
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  // store hooks
  const { updateProject } = useProject();
  const { isMobile } = usePlatformOS();

  // form info
  const {
    handleSubmit,
    watch,
    control,
    setValue,
    setError,
    reset,
    formState: { errors },
    getValues,
  } = useForm<IProject>({
    defaultValues: {
      ...project,
      workspace: (project.workspace as IWorkspace).id,
    },
  });
  // derived values
  const currentNetwork = NETWORK_CHOICES.find((n) => n.key === project?.network);
  const coverImage = watch("cover_image_url");

  useEffect(() => {
    if (project && projectId !== getValues("id")) {
      reset({
        ...project,
        workspace: (project.workspace as IWorkspace).id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projectId]);

  // handlers
  const handleIdentifierChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, "");
    const formattedValue = alphanumericValue.toUpperCase();
    setValue("identifier", formattedValue);
  };

  const handleUpdateChange = async (payload: Partial<IProject>) => {
    if (!workspaceSlug || !project) return;
    return updateProject(workspaceSlug.toString(), project.id, payload)
      .then(() => {
        setToast({
          type: "success",
          title: t("toast.success"),
          message: t("project_settings.general.toast.success"),
        });
        return undefined;
      })
      .catch((err) => {
        try {
          // Handle the new error format where codes are nested in arrays under field names
          const errorData = err ?? {};

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

  const onSubmit = async (formData: IProject) => {
    if (!workspaceSlug) return;
    setIsLoading(true);
    const payload: Partial<IProject> = {
      name: formData.name,
      network: formData.network,
      identifier: formData.identifier,
      description: formData.description,

      logo_props: formData.logo_props,
      timezone: formData.timezone,
      status: formData.status,
      labels: formData.labels,
    };

    // Handle cover image changes
    Object.assign(payload, getCoverImagePayload(project.cover_image_url, formData.cover_image_url));

    if (project.identifier !== formData.identifier)
      await projectService
        .checkProjectIdentifierAvailability(workspaceSlug, payload.identifier ?? "")
        .then(async (res) => {
          if (res.exists) setError("identifier", { message: t("common.identifier_already_exists") });
          else await handleUpdateChange(payload);
          return undefined;
        });
    else await handleUpdateChange(payload);
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="relative h-44 w-full overflow-hidden rounded-lg bg-[#262626]">
        {coverImage && (
          <>
            <CoverImage src={coverImage} alt={t("web.project_cover_image")} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        )}
        <div className="absolute bottom-4 z-5 flex w-full items-end justify-between gap-3 px-4">
          <div className="flex flex-grow gap-3 truncate">
            <Controller
              control={control}
              name="logo_props"
              render={({ field: { value, onChange } }) => (
                <EmojiPicker
                  iconType="material"
                  closeOnSelect={false}
                  isOpen={isOpen}
                  handleToggle={(val: boolean) => setIsOpen(val)}
                  className="flex items-center justify-center"
                  buttonClassName="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-lg bg-white/10"
                  label={
                    <span
                      className="grid size-full place-items-center rounded-lg"
                      style={getIconBackgroundStyle(value)}
                    >
                      <Logo background={false} logo={value} size={28} />
                    </span>
                  }
                  // TODO: fix types
                  onChange={(val: any) => {
                    let logoValue = {};

                    if (val?.type === "emoji")
                      logoValue = {
                        value: val.value,
                      };
                    else if (val?.type === "icon") logoValue = val.value;

                    onChange({
                      in_use: val?.type,
                      [val?.type]: logoValue,
                    });
                    setIsOpen(false);
                  }}
                  defaultIconBackground={value?.icon?.background_color}
                  onIconBackgroundChange={(background) => {
                    if (value?.in_use === "icon")
                      onChange({ ...value, icon: { ...value.icon, background_color: background } });
                  }}
                  defaultIconColor={value?.in_use && value.in_use === "icon" ? value?.icon?.color : undefined}
                  defaultOpen={value.in_use && value.in_use === "emoji" ? "emoji" : "icon"}
                  disabled={!isAdmin}
                />
              )}
            />
            <div className="flex flex-col gap-1 truncate text-on-color">
              <span className="truncate text-16 font-semibold">{watch("name")}</span>
              <span className="flex items-center gap-2 text-13">
                <span>{watch("identifier")} .</span>
                <span className="flex items-center gap-1.5">
                  {project.network === 0 && <LockOutline className="h-2.5 w-2.5 text-on-color" />}
                  {currentNetwork && t(currentNetwork?.i18n_label)}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-shrink-0 justify-center">
            <div>
              <Controller
                control={control}
                name="cover_image_url"
                render={({ field: { onChange } }) => (
                  <CoverImageUploadButton
                    onUploadingChange={setIsCoverUploading}
                    label={t("change_cover")}
                    onChange={onChange}
                    disabled={!isAdmin}
                    projectId={project.id}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h4 className="text-13">{t("common.project_name")}</h4>
          <Controller
            control={control}
            name="name"
            rules={{
              required: t("name_is_required"),
              maxLength: {
                value: 255,
                message: t("web.project_name_should_be_less_than_255_characters"),
              },
            }}
            render={({ field: { value, onChange, ref } }) => (
              <Field name="name" invalid={Boolean(errors.name)}>
                <InputGroup size="lg">
                  <Input
                    value={value}
                    size="lg"
                    id="name"
                    name="name"
                    type="text"
                    ref={ref}
                    onChange={onChange}
                    placeholder={t("common.project_name")}
                    disabled={!isAdmin}
                  />
                </InputGroup>
              </Field>
            )}
          />
          <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
        </div>
        <div className="flex flex-col gap-1 [&_textarea]:text-14">
          <h4 className="text-13">{t("description")}</h4>
          <Controller
            name="description"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Field name="description" invalid={Boolean(errors?.description)} disabled={!isAdmin}>
                <TextAreaGroup resize="none">
                  <TextArea
                    value={value}
                    size="lg"
                    surface="field"
                    autoResize
                    maxRows={8}
                    id="description"
                    name="description"
                    placeholder={t("project_description_placeholder")}
                    onChange={onChange}
                  />
                </TextAreaGroup>
              </Field>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-13">{t("web.project_id")}</h4>
            <div className="relative">
              <Controller
                control={control}
                name="identifier"
                rules={{
                  required: t("project_id_is_required"),
                  validate: (value) => /^[ÇŞĞIİÖÜA-Z0-9]+$/.test(value.toUpperCase()) || t("project_id_allowed_char"),
                  minLength: {
                    value: 1,
                    message: t("project_id_min_char"),
                  },
                  maxLength: {
                    value: 12,
                    message: t("project_id_max_char", { max: 12 }),
                  },
                }}
                render={({ field: { value, ref } }) => (
                  <Field name="identifier" invalid={Boolean(errors.identifier)}>
                    <InputGroup size="lg">
                      <Input
                        value={value}
                        size="lg"
                        id="identifier"
                        name="identifier"
                        type="text"
                        onChange={handleIdentifierChange}
                        ref={ref}
                        placeholder={t("project_settings.general.enter_project_id")}
                        disabled={!isAdmin}
                      />
                      <Tooltip label={t("project_id_tooltip_content")} side="top" align="center" disabled={isMobile}>
                        <IconButton
                          type="button"
                          size="xs"
                          variant="ghost"
                          aria-label={t("project_id_tooltip_content")}
                          icon={<InfoOutline />}
                        />
                      </Tooltip>
                    </InputGroup>
                  </Field>
                )}
              />
            </div>
            <span className="text-11 text-danger-primary">
              <>{errors?.identifier?.message}</>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-13">{t("workspace_projects.network.label")}</h4>
            <Controller
              name="network"
              control={control}
              render={({ field: { value, onChange } }) => {
                const selectedNetwork = NETWORK_CHOICES.find((n) => n.key === value);
                return (
                  <Select<TNetworkChoice>
                    getValues={() => NETWORK_CHOICES}
                    value={selectedNetwork ?? null}
                    onChange={(key) => onChange(Number(key))}
                    getOptionValue={(network) => String(network.key)}
                    getOptionLabel={(network) => t(network.i18n_label)}
                    getOptionIcon={renderNetworkOptionIcon}
                    getOptionDescription={(network) => t(network.description)}
                    placeholder={t("select_network")}
                    showSearch={false}
                    pinSelected={false}
                    contentSizing="anchor"
                    disabled={!isAdmin}
                    estimateItemSize={64}
                  >
                    <Select.Trigger<TNetworkChoice>
                      variant="select-lg"
                      className="font-medium"
                      disabled={!isAdmin}
                      prependIcon={renderNetworkTriggerIcon}
                    >
                      {(networks) => (
                        <span className="min-w-0 grow truncate text-left">
                          {networks[0] ? t(networks[0].i18n_label) : t("select_network")}
                        </span>
                      )}
                    </Select.Trigger>
                  </Select>
                );
              }}
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1 sm:col-span-2 xl:col-span-1">
            <h4 className="text-13">{t("common.project_timezone")}</h4>
            <Controller
              name="timezone"
              control={control}
              rules={{ required: t("project_settings.general.please_select_a_timezone") }}
              render={({ field: { value, onChange } }) => (
                <>
                  <TimezoneSelect
                    value={value}
                    onChange={(timezone: string) => {
                      onChange(timezone);
                    }}
                    error={Boolean(errors.timezone)}
                    buttonClassName="!border-subtle !shadow-none font-medium rounded-md"
                    disabled={!isAdmin}
                  />
                </>
              )}
            />
            {errors.timezone && <span className="text-11 text-danger-primary">{errors.timezone.message}</span>}
          </div>
        </div>
        <ProjectCategoryFields
          workspaceSlug={workspaceSlug}
          status={watch("status")}
          labels={watch("labels")}
          disabled={!isAdmin}
          onStatus={(id) => setValue("status", id, { shouldDirty: true })}
          onLabels={(ids) => setValue("labels", ids, { shouldDirty: true })}
        />
        <div className="flex items-center justify-between py-2">
          <>
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              label={isLoading ? t("updating") : t("common.update_project")}
              loading={isLoading}
              disabled={!isAdmin || isCoverUploading}
            />
            <span className="text-13 text-placeholder italic">
              {t("common.created_on")} {renderFormattedDate(project?.created_at)}
            </span>
          </>
        </div>
      </div>
    </form>
  );
}
