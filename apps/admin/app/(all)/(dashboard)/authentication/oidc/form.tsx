/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import type { IFormattedInstanceConfiguration, TInstanceOIDCAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = {
  config: IFormattedInstanceConfiguration;
};

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
  const { config } = props;
  const { t } = useTranslation();
  const trustEmailLabelId = useId();
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">
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
                <h4 id={trustEmailLabelId} className="text-sm text-custom-text-300">
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
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                  label={isSubmitting ? t("admin.common.saving") : t("admin.common.save_changes")}
                />
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  nativeButton={false}
                  render={<Link href="/authentication" onClick={handleGoBack} />}
                  label={t("admin.common.go_back")}
                />
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">
                {t("admin.authentication.oauth.plane_details_for_provider", { provider: "OIDC" })}
              </div>
              {OIDC_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
