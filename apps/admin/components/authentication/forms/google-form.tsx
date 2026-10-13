/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { isEmpty } from "lodash-es";
import { useForm } from "react-hook-form";
import { MonitorOutline } from "@makeplane/propel/icons";
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
import type { TInstanceGoogleAuthenticationConfigurationKeys } from "@plane/types";
// components
import type { TProviderConfigFormProps } from "@/components/authentication/provider-config-modal";
import { CodeBlock } from "@/components/common/code-block";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import { ControllerInput } from "@/components/common/controller-input";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = TProviderConfigFormProps;

type GoogleConfigFormValues = Record<TInstanceGoogleAuthenticationConfigurationKeys, string>;

const GOOGLE_FORM_SWITCH_FIELD: TControllerSwitchFormField<GoogleConfigFormValues> = {
  name: "ENABLE_GOOGLE_SYNC",
  label: "Google",
};

export function InstanceGoogleConfigForm(props: Props) {
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
  } = useForm<GoogleConfigFormValues>({
    defaultValues: {
      GOOGLE_CLIENT_ID: config["GOOGLE_CLIENT_ID"],
      GOOGLE_CLIENT_SECRET: config["GOOGLE_CLIENT_SECRET"],
      ENABLE_GOOGLE_SYNC: config["ENABLE_GOOGLE_SYNC"] || "0",
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const GOOGLE_FORM_FIELDS: TControllerInputFormField<GoogleConfigFormValues>[] = [
    {
      key: "GOOGLE_CLIENT_ID",
      type: "text",
      label: t("admin.authentication.oauth.client_id"),
      description: (
        <>
          {t("admin.authentication.oauth.google_client_id_description")}{" "}
          <a
            href="https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#creatingcred"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={t("admin.authentication.oauth.google_client_id_docs")}
          >
            {t("admin.common.learn_more")}
          </a>
        </>
      ),
      placeholder: "840195096245-0p2tstej9j5nc4l8o1ah2dqondscqc1g.apps.googleusercontent.com",
      error: Boolean(errors.GOOGLE_CLIENT_ID),
      required: true,
    },
    {
      key: "GOOGLE_CLIENT_SECRET",
      type: "password",
      label: t("admin.authentication.oauth.client_secret"),
      description: (
        <>
          {t("admin.authentication.oauth.google_client_secret_description")}{" "}
          <a
            href="https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={t("admin.authentication.oauth.google_client_secret_docs")}
          >
            {t("admin.common.learn_more")}
          </a>
        </>
      ),
      placeholder: "GOCShX-ADp4cI0kPqav1gGCBg5bE02E",
      error: Boolean(errors.GOOGLE_CLIENT_SECRET),
      required: true,
    },
  ];

  const GOOGLE_COMMON_SERVICE_DETAILS: TCopyField[] = [
    {
      key: "Origin_URL",
      label: t("admin.authentication.oauth.origin_url"),
      url: originURL,
      description: (
        <p>
          {t("admin.authentication.oauth.auto_generated_paste_into")}{" "}
          <CodeBlock darkerShade>{t("admin.authentication.oauth.authorized_js_origins")}</CodeBlock>{" "}
          {t("admin.authentication.oauth.field_for_this_client")}{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials/oauthclient"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={t("admin.authentication.oauth.google_console_credentials")}
          >
            {t("admin.authentication.oauth.here")}
          </a>
        </p>
      ),
    },
  ];

  const GOOGLE_SERVICE_DETAILS: TCopyField[] = [
    {
      key: "Callback_URI",
      label: t("admin.authentication.oauth.callback_uri"),
      url: `${originURL}/auth/google/callback/`,
      description: (
        <p>
          {t("admin.authentication.oauth.auto_generated_paste_into")}{" "}
          <CodeBlock darkerShade>{t("admin.authentication.oauth.authorized_redirect_uri")}</CodeBlock>{" "}
          {t("admin.authentication.oauth.field_for_this_client")}{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials/oauthclient"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={t("admin.authentication.oauth.google_console_credentials")}
          >
            {t("admin.authentication.oauth.here")}
          </a>
        </p>
      ),
    },
  ];

  const onSubmit = async (formData: GoogleConfigFormValues) => {
    const payload: Partial<GoogleConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: "success",
        title: t("admin.authentication.oauth.done"),
        message: t("admin.authentication.oauth.configured", { provider: "Google" }),
      });
      reset({
        GOOGLE_CLIENT_ID: response.find((item) => item.key === "GOOGLE_CLIENT_ID")?.value,
        GOOGLE_CLIENT_SECRET: response.find((item) => item.key === "GOOGLE_CLIENT_SECRET")?.value,
        ENABLE_GOOGLE_SYNC: response.find((item) => item.key === "ENABLE_GOOGLE_SYNC")?.value,
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
            <DialogTitle>{t("admin.authentication.configure_provider", { provider: "Google" })}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <div className="grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.provider_details_for_plane", { provider: "Google" })}
              </div>
              {GOOGLE_FORM_FIELDS.map((field) => (
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
              <ControllerSwitch control={control} field={GOOGLE_FORM_SWITCH_FIELD} />
            </div>
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.plane_details_for_provider", { provider: "Google" })}
              </div>

              <div className="flex flex-col gap-y-4">
                {/* common service details */}
                <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 py-4">
                  {GOOGLE_COMMON_SERVICE_DETAILS.map((field) => (
                    <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
                  ))}
                </div>

                {/* web service details */}
                <div className="flex flex-col overflow-hidden rounded-lg">
                  <div className="flex items-center gap-x-3 bg-layer-3 px-6 py-3 text-11 font-medium text-secondary uppercase">
                    <MonitorOutline className="h-3 w-3" />
                    {t("admin.authentication.oauth.web")}
                  </div>
                  <div className="flex flex-col gap-y-4 bg-layer-1 px-6 py-4">
                    {GOOGLE_SERVICE_DETAILS.map((field) => (
                      <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
