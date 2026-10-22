import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import { translate, useTranslation } from "@plane/i18n";
import { PageWrapper } from "@/components/common/page-wrapper";
import { ControllerInput } from "@/components/common/controller-input";
import { CopyField } from "@/components/common/copy-field";
import { Skeleton } from "@/components/common/skeleton";
import { FeishuService } from "@/services/feishu.service";
import type { TFeishuConfiguration, TFeishuFormValues } from "@/types/feishu";
import { buildFeishuPayload, getFeishuErrorCode } from "./helper";
import { FeishuDeliveryStatus } from "./delivery-status";
import type { Route } from "./+types/page";

const service = new FeishuService();

function FeishuForm({ config, refresh }: { config: TFeishuConfiguration; refresh: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [action, setAction] = useState<"check" | "test" | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<TFeishuFormValues>({
    defaultValues: {
      FEISHU_ENABLED: config.enabled,
      FEISHU_APP_ID: config.app_id,
      FEISHU_APP_SECRET: "",
      FEISHU_VERIFICATION_TOKEN: "",
      FEISHU_ENCRYPT_KEY: "",
    },
  });
  const busy = isSubmitting || action !== null;

  const showError = (error: unknown) => {
    const code = getFeishuErrorCode(error);
    setToast({
      type: "error",
      title: t("admin.common.error"),
      message:
        code === "account_not_bound"
          ? t("admin.feishu.bind_first")
          : code === "feishu_disabled"
            ? t("admin.feishu.enable_first")
            : t("admin.feishu.request_failed"),
    });
  };

  const save = async (values: TFeishuFormValues) => {
    try {
      const payload = buildFeishuPayload(values);
      await service.saveConfiguration(payload);
      reset({
        ...values,
        FEISHU_APP_ID: payload.FEISHU_APP_ID,
        FEISHU_APP_SECRET: "",
        FEISHU_VERIFICATION_TOKEN: "",
        FEISHU_ENCRYPT_KEY: "",
      });
      await refresh();
      setToast({ type: "success", title: t("admin.common.success"), message: t("admin.feishu.saved") });
    } catch (error) {
      showError(error);
    }
  };

  const runAction = async (nextAction: "check" | "test") => {
    setAction(nextAction);
    try {
      if (nextAction === "check") await service.checkConfiguration();
      else await service.sendTest();
      setToast({
        type: "success",
        title: t("admin.common.success"),
        message: t(nextAction === "check" ? "admin.feishu.check_success" : "admin.feishu.test_queued"),
      });
    } catch (error) {
      showError(error);
    } finally {
      setAction(null);
    }
  };

  return (
    <form className="flex max-w-2xl flex-col gap-6" onSubmit={(event) => void handleSubmit(save)(event)}>
      <output className="text-13 text-secondary">
        {t(config.enabled ? "admin.feishu.enabled" : "admin.feishu.disabled")}
      </output>
      {config.managed_by_env && <p className="text-13 text-tertiary">{t("admin.feishu.managed_by_env")}</p>}
      <fieldset disabled={busy || config.managed_by_env} className="flex flex-col gap-6 disabled:opacity-60">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="feishu-enabled" className="text-13 text-secondary">
            {t("admin.feishu.enable")}
          </label>
          <Controller
            control={control}
            name="FEISHU_ENABLED"
            render={({ field }) => (
              <Switch
                id="feishu-enabled"
                checked={field.value}
                onCheckedChange={field.onChange}
                size="sm"
                disabled={busy || config.managed_by_env}
              />
            )}
          />
        </div>
        <p className="text-11 text-tertiary">{t("admin.feishu.enable_description")}</p>
        <ControllerInput
          control={control}
          name="FEISHU_APP_ID"
          type="text"
          label="App ID"
          placeholder="cli_..."
          required={false}
          error={Boolean(errors.FEISHU_APP_ID)}
        />
        <ControllerInput
          control={control}
          name="FEISHU_APP_SECRET"
          type="password"
          label="App secret"
          placeholder={t(
            config.secret_configured ? "admin.feishu.secret_configured" : "admin.feishu.secret_not_configured"
          )}
          description={t("admin.feishu.secret_description")}
          required={false}
          error={Boolean(errors.FEISHU_APP_SECRET)}
        />
        <p className="text-11 text-tertiary">
          {t(config.secret_configured ? "admin.feishu.secret_configured" : "admin.feishu.secret_not_configured")}
        </p>
        <ControllerInput
          control={control}
          name="FEISHU_VERIFICATION_TOKEN"
          type="password"
          label="Verification token"
          placeholder={t(
            config.verification_token_configured
              ? "admin.feishu.verification_token_configured"
              : "admin.feishu.verification_token_not_configured"
          )}
          description={t("admin.feishu.secret_description")}
          required={false}
          error={Boolean(errors.FEISHU_VERIFICATION_TOKEN)}
        />
        <p className="text-11 text-tertiary">
          {t(
            config.verification_token_configured
              ? "admin.feishu.verification_token_configured"
              : "admin.feishu.verification_token_not_configured"
          )}
        </p>
        <ControllerInput
          control={control}
          name="FEISHU_ENCRYPT_KEY"
          type="password"
          label="Encrypt key"
          placeholder={t(
            config.encrypt_key_configured
              ? "admin.feishu.encrypt_key_configured"
              : "admin.feishu.encrypt_key_not_configured"
          )}
          description={t("admin.feishu.secret_description")}
          required={false}
          error={Boolean(errors.FEISHU_ENCRYPT_KEY)}
        />
        <p className="text-11 text-tertiary">
          {t(
            config.encrypt_key_configured
              ? "admin.feishu.encrypt_key_configured"
              : "admin.feishu.encrypt_key_not_configured"
          )}
        </p>
        <div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            stretch="auto"
            disabled={!isDirty || busy || config.managed_by_env}
            loading={isSubmitting}
            label={t("admin.common.save_changes")}
          />
        </div>
      </fieldset>
      <CopyField
        label={t("admin.feishu.callback_url")}
        url={config.callback_url}
        description={t("admin.feishu.callback_description")}
      />
      <CopyField
        label={t("admin.feishu.card_callback_url")}
        url={config.card_callback_url}
        description={t("admin.feishu.card_callback_description")}
      />
      <p className="text-13 text-tertiary">{t("admin.feishu.personal_message_permissions")}</p>
      <div className="flex flex-col gap-3 border-t border-subtle pt-6">
        <p className="text-13 text-secondary">{t("admin.feishu.saved_config_actions")}</p>
        <p className="text-13 text-tertiary">{t("admin.feishu.check_scope")}</p>
        {!config.current_user_bound && <p className="text-13 text-tertiary">{t("admin.feishu.bind_first")}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            stretch="auto"
            disabled={busy || isDirty || !config.app_id || !config.secret_configured}
            loading={action === "check"}
            onClick={() => void runAction("check")}
            label={t("admin.feishu.check")}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            stretch="auto"
            disabled={busy || isDirty || !config.enabled || !config.current_user_bound}
            loading={action === "test"}
            onClick={() => void runAction("test")}
            label={t("admin.feishu.test")}
          />
        </div>
      </div>
      <FeishuDeliveryStatus delivery={config.last_delivery} refresh={refresh} disabled={busy || isDirty} />
    </form>
  );
}

export default function FeishuPage() {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useSWR("INSTANCE_FEISHU_CONFIGURATION", () => service.configuration());
  return (
    <PageWrapper header={{ title: t("admin.feishu.title"), description: t("admin.feishu.description") }}>
      {isLoading ? (
        <Skeleton>
          <Skeleton.Item height="200px" width="100%" />
        </Skeleton>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t("admin.feishu.load_failed")}</p>
          <Button
            variant="secondary"
            size="lg"
            stretch="auto"
            onClick={() => void mutate()}
            label={t("admin.feishu.retry")}
          />
        </div>
      ) : data ? (
        <FeishuForm
          key={`${data.enabled}-${data.app_id}-${data.secret_configured}-${data.verification_token_configured}-${data.encrypt_key_configured}-${data.managed_by_env}`}
          config={data}
          refresh={mutate}
        />
      ) : null}
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: translate("admin.feishu.title") }];
