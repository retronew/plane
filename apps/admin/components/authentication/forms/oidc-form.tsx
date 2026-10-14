/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useId } from "react";
import { isEmpty } from "lodash-es";
import { Controller, useForm } from "react-hook-form";
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
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import type { TInstanceOIDCAuthenticationConfigurationKeys } from "@plane/types";
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

type OIDCConfigFormValues = Record<TInstanceOIDCAuthenticationConfigurationKeys, string>;

const OIDC_FORM_SWITCH_FIELD: TControllerSwitchFormField<OIDCConfigFormValues> = {
  name: "ENABLE_OIDC_SYNC",
  label: "OIDC",
};

const OIDC_CONFIG_KEYS: TInstanceOIDCAuthenticationConfigurationKeys[] = [
  "OIDC_PROVIDER_NAME",
  "OIDC_ISSUER_URL",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_TRUST_EMAIL",
  "ENABLE_OIDC_SYNC",
];

export function InstanceOIDCConfigForm(props: Props) {
  const { config, handleClose, onDirtyChange } = props;
  const { t } = useTranslation();
  const trustEmailLabelId = useId();
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OIDCConfigFormValues>({
    defaultValues: {
      OIDC_PROVIDER_NAME: config["OIDC_PROVIDER_NAME"] || "OIDC",
      OIDC_ISSUER_URL: config["OIDC_ISSUER_URL"],
      OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"],
      OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"],
      OIDC_TRUST_EMAIL: config["OIDC_TRUST_EMAIL"] || "0",
      ENABLE_OIDC_SYNC: config["ENABLE_OIDC_SYNC"] || "0",
    },
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField<OIDCConfigFormValues>[] = [
    {
      key: "OIDC_PROVIDER_NAME",
      type: "text",
      label: t("admin.authentication.oauth.oidc_provider_name"),
      description: <>{t("admin.authentication.oauth.oidc_provider_name_description")}</>,
      placeholder: "Casdoor",
      error: Boolean(errors.OIDC_PROVIDER_NAME),
      required: true,
    },
    {
      key: "OIDC_ISSUER_URL",
      type: "text",
      label: t("admin.authentication.oauth.oidc_issuer_url"),
      description: <>{t("admin.authentication.oauth.oidc_issuer_url_description")}</>,
      placeholder: "https://auth.example.com",
      error: Boolean(errors.OIDC_ISSUER_URL),
      required: true,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: t("admin.authentication.oauth.client_id"),
      description: <>{t("admin.authentication.oauth.oidc_client_description")}</>,
      placeholder: "70a44354520df8bd9bcd",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: t("admin.authentication.oauth.client_secret"),
      description: <>{t("admin.authentication.oauth.oidc_client_description")}</>,
      placeholder: "9b0050f94ec1b744e32ce79ea4ffacd40d4119cb",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: true,
    },
  ];

  const OIDC_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: t("admin.authentication.oauth.callback_uri"),
      url: `${originURL}/auth/oidc/callback/`,
      description: (
        <>
          {t("admin.authentication.oauth.auto_generated_paste_into")}{" "}
          <CodeBlock darkerShade>{t("admin.authentication.oauth.redirect_uri")}</CodeBlock>{" "}
          {t("admin.authentication.oauth.oidc_redirect_uri_suffix")}
        </>
      ),
    },
  ];

  const onSubmit = async (formData: OIDCConfigFormValues) => {
    const payload: Partial<OIDCConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: "success",
        title: t("admin.authentication.oauth.done"),
        message: t("admin.authentication.oauth.configured", { provider: "OIDC" }),
      });
      reset(
        Object.fromEntries(
          OIDC_CONFIG_KEYS.map((key) => [key, response.find((item) => item.key === key)?.value])
        ) as OIDCConfigFormValues
      );
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
            <DialogTitle>{t("admin.authentication.configure_provider", { provider: "OIDC" })}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <div className="grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.provider_details_for_plane", { provider: "OIDC" })}
              </div>
              {OIDC_FORM_FIELDS.map((field) => (
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
              <ControllerSwitch control={control} field={OIDC_FORM_SWITCH_FIELD} />
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 id={trustEmailLabelId} className="text-13 text-tertiary">
                    {t("admin.authentication.oauth.oidc_trust_email")}
                  </h4>
                  <Controller
                    control={control}
                    name="OIDC_TRUST_EMAIL"
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        checked={value === "1"}
                        onCheckedChange={() => onChange(value === "1" ? "0" : "1")}
                        size="sm"
                        aria-labelledby={trustEmailLabelId}
                      />
                    )}
                  />
                </div>
                <p className="text-11 text-tertiary">{t("admin.authentication.oauth.oidc_trust_email_description")}</p>
              </div>
            </div>
            <PlaneDetailsPanel
              title={t("admin.authentication.oauth.plane_details_for_provider", { provider: "OIDC" })}
              fields={OIDC_SERVICE_FIELD}
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
