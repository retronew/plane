/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import type { IInstance, IInstanceAdmin } from "@plane/types";
// components
import { ControllerInput } from "@/components/common/controller-input";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

export interface IGeneralConfigurationForm {
  instance: IInstance;
  instanceAdmins: IInstanceAdmin[];
}

export const GeneralConfigurationForm = observer(function GeneralConfigurationForm(props: IGeneralConfigurationForm) {
  const { instance, instanceAdmins } = props;
  // hooks
  const { updateInstanceInfo } = useInstance();
  const { t } = useTranslation();

  // form data
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Partial<IInstance>>({
    defaultValues: {
      instance_name: instance?.instance_name,
    },
  });

  const onSubmit = async (formData: Partial<IInstance>) => {
    const payload: Partial<IInstance> = { ...formData };

    await updateInstanceInfo(payload)
      .then(() =>
        setToast({
          type: "success",
          title: t("admin.common.success"),
          message: t("admin.general.toast_updated"),
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="text-16 font-medium text-primary">{t("admin.general.instance_details")}</div>
        <div className="grid-col grid w-full grid-cols-1 items-center justify-between gap-8 md:grid-cols-2 lg:grid-cols-3">
          <ControllerInput
            key="instance_name"
            name="instance_name"
            control={control}
            type="text"
            label={t("admin.general.instance_name")}
            placeholder={t("admin.general.instance_name_placeholder")}
            error={Boolean(errors.instance_name)}
            required
          />

          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">{t("admin.general.admin_email")}</h4>
            <div className="w-full">
              <InputGroup size="lg">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  size="lg"
                  value={instanceAdmins[0]?.user_detail?.email ?? ""}
                  placeholder={t("admin.general.admin_email")}
                  autoComplete="on"
                  disabled
                />
              </InputGroup>
            </div>
            <p className="text-11 text-tertiary">{t("admin.general.admin_email_description")}</p>
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">{t("admin.general.instance_id")}</h4>
            <div className="w-full">
              <InputGroup size="lg">
                <Input
                  id="instance_id"
                  name="instance_id"
                  type="text"
                  size="lg"
                  value={instance.instance_id}
                  disabled
                />
              </InputGroup>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={() => {
            void handleSubmit(onSubmit)();
          }}
          loading={isSubmitting}
          label={isSubmitting ? t("admin.common.saving") : t("admin.common.save_changes")}
        />
      </div>
    </div>
  );
});
