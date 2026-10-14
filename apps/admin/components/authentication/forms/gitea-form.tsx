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
import type { TInstanceGiteaAuthenticationConfigurationKeys } from "@plane/types";
// components
import type { TProviderConfigFormProps } from "@/components/authentication/provider-config-modal";
import { CodeBlock } from "@/components/common/code-block";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { PlaneDetailsPanel } from "./plane-details-panel";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = TProviderConfigFormProps;

type GiteaConfigFormValues = Record<TInstanceGiteaAuthenticationConfigurationKeys, string>;

const GITEA_FORM_SWITCH_FIELD: TControllerSwitchFormField<GiteaConfigFormValues> = {
  name: "ENABLE_GITEA_SYNC",
  label: "Gitea",
};

export function InstanceGiteaConfigForm(props: Props) {
  const { config, handleClose, onDirtyChange } = props;
  const { t } = useTranslation();
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<GiteaConfigFormValues>({
    defaultValues: {
      GITEA_HOST: config["GITEA_HOST"] || "https://gitea.com",
      GITEA_CLIENT_ID: config["GITEA_CLIENT_ID"],
      GITEA_CLIENT_SECRET: config["GITEA_CLIENT_SECRET"],
      ENABLE_GITEA_SYNC: config["ENABLE_GITEA_SYNC"] || "0",
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const GITEA_FORM_FIELDS: TControllerInputFormField<GiteaConfigFormValues>[] = [
    {
      key: "GITEA_HOST",
      type: "text",
      label: t("admin.authentication.oauth.gitea_host"),
      description: <>{t("admin.authentication.oauth.gitea_host_description")}</>,
      placeholder: "https://gitea.com",
      error: Boolean(errors.GITEA_HOST),
      required: true,
    },
    {
      key: "GITEA_CLIENT_ID",
      type: "text",
      label: t("admin.authentication.oauth.client_id"),
      description: (
        <>
          {t("admin.authentication.oauth.get_from_your")}{" "}
          <a
            href="https://gitea.com/user/settings/applications"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            {t("admin.authentication.oauth.app_settings", { provider: "Gitea" })}
          </a>
        </>
      ),
      placeholder: "70a44354520df8bd9bcd",
      error: Boolean(errors.GITEA_CLIENT_ID),
      required: true,
    },
    {
      key: "GITEA_CLIENT_SECRET",
      type: "password",
      label: t("admin.authentication.oauth.client_secret"),
      description: (
        <>
          {t("admin.authentication.oauth.secret_also_in_your")}{" "}
          <a
            href="https://gitea.com/user/settings/applications"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            {t("admin.authentication.oauth.app_settings", { provider: "Gitea" })}
          </a>
        </>
      ),
      placeholder: "9b0050f94ec1b744e32ce79ea4ffacd40d4119cb",
      error: Boolean(errors.GITEA_CLIENT_SECRET),
      required: true,
    },
  ];

  const GITEA_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: t("admin.authentication.oauth.callback_uri"),
      url: `${originURL}/auth/gitea/callback/`,
      description: (
        <>
          {t("admin.authentication.oauth.auto_generated_paste_into")}{" "}
          <CodeBlock darkerShade>{t("admin.authentication.oauth.authorized_callback_uri")}</CodeBlock>{" "}
          {t("admin.authentication.oauth.field")}{" "}
          <a
            href={`${control._formValues.GITEA_HOST || "https://gitea.com"}/user/settings/applications`}
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={t("admin.authentication.oauth.app_settings", { provider: "Gitea" })}
          >
            {t("admin.authentication.oauth.here")}
          </a>
        </>
      ),
    },
  ];

  const onSubmit = async (formData: GiteaConfigFormValues) => {
    const payload: Partial<GiteaConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: "success",
        title: t("admin.authentication.oauth.done"),
        message: t("admin.authentication.oauth.configured", { provider: "Gitea" }),
      });
      reset({
        GITEA_HOST: response.find((item) => item.key === "GITEA_HOST")?.value,
        GITEA_CLIENT_ID: response.find((item) => item.key === "GITEA_CLIENT_ID")?.value,
        GITEA_CLIENT_SECRET: response.find((item) => item.key === "GITEA_CLIENT_SECRET")?.value,
        ENABLE_GITEA_SYNC: response.find((item) => item.key === "ENABLE_GITEA_SYNC")?.value,
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
            <DialogTitle>{t("admin.authentication.configure_provider", { provider: "Gitea" })}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <div className="grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.provider_details_for_plane", { provider: "Gitea" })}
              </div>
              {GITEA_FORM_FIELDS.map((field) => (
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
              <ControllerSwitch control={control} field={GITEA_FORM_SWITCH_FIELD} />
            </div>
            <PlaneDetailsPanel
              title={t("admin.authentication.oauth.plane_details_for_provider", { provider: "Gitea" })}
              fields={GITEA_SERVICE_FIELD}
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
