/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { isEmpty } from "lodash-es";
import { useForm } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { TInstanceGitlabAuthenticationConfigurationKeys } from "@plane/types";
// components
import type { TProviderConfigFormProps } from "@/components/authentication/provider-config-modal";
import { CodeBlock } from "@/components/common/code-block";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import { ControllerInput } from "@/components/common/controller-input";
import type { TCopyField } from "@/components/common/copy-field";
import { PlaneDetailsPanel } from "./plane-details-panel";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = TProviderConfigFormProps;

type GitlabConfigFormValues = Record<TInstanceGitlabAuthenticationConfigurationKeys, string>;

const GITLAB_FORM_SWITCH_FIELD: TControllerSwitchFormField<GitlabConfigFormValues> = {
  name: "ENABLE_GITLAB_SYNC",
  label: "GitLab",
};

export function InstanceGitlabConfigForm(props: Props) {
  const { config, handleClose, onDirtyChange } = props;
  const { t } = useTranslation();
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    subscribe,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<GitlabConfigFormValues>({
    defaultValues: {
      GITLAB_HOST: config["GITLAB_HOST"],
      GITLAB_CLIENT_ID: config["GITLAB_CLIENT_ID"],
      GITLAB_CLIENT_SECRET: config["GITLAB_CLIENT_SECRET"],
      ENABLE_GITLAB_SYNC: config["ENABLE_GITLAB_SYNC"] || "0",
    },
  });

  // Report dirtiness from the form subscription, so the parent updates on the change itself
  // instead of after an extra render.
  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty: nextIsDirty }) => onDirtyChange(nextIsDirty ?? false),
    });
    return unsubscribe;
  }, [subscribe, onDirtyChange]);

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const GITLAB_FORM_FIELDS: TControllerInputFormField<GitlabConfigFormValues>[] = [
    {
      key: "GITLAB_HOST",
      type: "text",
      label: t("admin.email.form.host"),
      description: (
        <>
          {t("admin.authentication.oauth.gitlab_host_prefix")} <CodeBlock>domain.tld</CodeBlock>{" "}
          {t("admin.authentication.oauth.gitlab_host_suffix")}
        </>
      ),
      placeholder: "https://gitlab.com",
      error: Boolean(errors.GITLAB_HOST),
      required: true,
    },
    {
      key: "GITLAB_CLIENT_ID",
      type: "text",
      label: t("admin.authentication.oauth.application_id"),
      description: (
        <>
          {t("admin.authentication.oauth.get_from_your")}{" "}
          <a
            href="https://docs.gitlab.com/ee/integration/oauth_provider.html"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            {t("admin.authentication.oauth.app_settings_no_period", { provider: "GitLab" })}
          </a>
          .
        </>
      ),
      placeholder: "c2ef2e7fc4e9d15aa7630f5637d59e8e4a27ff01dceebdb26b0d267b9adcf3c3",
      error: Boolean(errors.GITLAB_CLIENT_ID),
      required: true,
    },
    {
      key: "GITLAB_CLIENT_SECRET",
      type: "password",
      label: t("admin.authentication.oauth.secret"),
      description: (
        <>
          {t("admin.authentication.oauth.secret_also_in_your")}{" "}
          <a
            href="https://docs.gitlab.com/ee/integration/oauth_provider.html"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            {t("admin.authentication.oauth.app_settings_no_period", { provider: "GitLab" })}
          </a>
          .
        </>
      ),
      placeholder: "gloas-f79cfa9a03c97f6ffab303177a5a6778a53c61e3914ba093412f68a9298a1b28",
      error: Boolean(errors.GITLAB_CLIENT_SECRET),
      required: true,
    },
  ];

  const GITLAB_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URL",
      label: t("admin.authentication.oauth.callback_url"),
      url: `${originURL}/auth/gitlab/callback/`,
      description: (
        <>
          {t("admin.authentication.oauth.auto_generated_paste_into")}{" "}
          <CodeBlock darkerShade>{t("admin.authentication.oauth.redirect_uri")}</CodeBlock>{" "}
          {t("admin.authentication.oauth.field_of_your")}{" "}
          <a
            href="https://docs.gitlab.com/ee/integration/oauth_provider.html"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            {t("admin.authentication.oauth.oauth_application", { provider: "GitLab" })}
          </a>
          .
        </>
      ),
    },
  ];

  const onSubmit = async (formData: GitlabConfigFormValues) => {
    const payload: Partial<GitlabConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: "success",
        title: t("admin.authentication.oauth.done"),
        message: t("admin.authentication.oauth.configured", { provider: "GitLab" }),
      });
      reset({
        GITLAB_HOST: response.find((item) => item.key === "GITLAB_HOST")?.value,
        GITLAB_CLIENT_ID: response.find((item) => item.key === "GITLAB_CLIENT_ID")?.value,
        GITLAB_CLIENT_SECRET: response.find((item) => item.key === "GITLAB_CLIENT_SECRET")?.value,
        ENABLE_GITLAB_SYNC: response.find((item) => item.key === "ENABLE_GITLAB_SYNC")?.value,
      });
      handleClose(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("admin.authentication.configure_provider", { provider: "GitLab" })}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <div className="grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.provider_details_for_plane", { provider: "GitLab" })}
              </div>
              {GITLAB_FORM_FIELDS.map((field) => (
                <ControllerInput
                  key={field.key}
                  control={control}
                  type={field.type}
                  name={field.key}
                  label={field.label}
                  description={field.description}
                  placeholder={field.placeholder}
                  error={field.error}
                  required={field.required}
                />
              ))}
              <ControllerSwitch control={control} field={GITLAB_FORM_SWITCH_FIELD} />
            </div>
            <PlaneDetailsPanel
              title={t("admin.authentication.oauth.plane_details_for_provider", { provider: "GitLab" })}
              fields={GITLAB_SERVICE_FIELD}
            />
          </div>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          onClick={() => handleClose()}
          label={t("admin.common.cancel")}
        />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={(e) => void handleSubmit(onSubmit)(e)}
          loading={isSubmitting}
          disabled={!isDirty}
          label={isSubmitting ? t("admin.common.saving") : t("admin.common.save_changes")}
        />
      </DialogActions>
    </>
  );
}
