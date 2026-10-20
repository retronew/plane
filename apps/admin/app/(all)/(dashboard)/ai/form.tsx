/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Button } from "@makeplane/propel/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
} from "@makeplane/propel/components/combobox";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { InstanceService } from "@plane/services";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys, TInstanceAIProtocol } from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";
import type { TTranslationStore } from "@plane/i18n";
// local
import { ModelPicker } from "./model-picker";
import { AI_PROTOCOLS, TRANSLATED_AI_PROVIDERS, getAIProtocol, resolveAIBaseUrl } from "./helper";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const instanceService = new InstanceService();

const CUSTOM_PROVIDER = "custom";

const getErrorMessage = (error: unknown): string | undefined =>
  error && typeof error === "object" && "error" in error ? String(error.error) : undefined;

type TTranslate = TTranslationStore["t"];

interface IAIProviderFieldProps {
  t: TTranslate;
  providerKeys: string[];
  selectedProvider: string;
  onProviderChange: (key: string) => void;
  filterProvider: (key: string, query: string) => boolean;
  providerLabel: (key: string) => string;
}

function AIProviderField(props: IAIProviderFieldProps) {
  const { t, providerKeys, selectedProvider, onProviderChange, filterProvider, providerLabel } = props;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="ai-provider" className="text-13 text-tertiary">
        {t("admin.ai.provider")}
      </label>
      <Combobox<string>
        items={providerKeys}
        value={selectedProvider}
        onValueChange={(next) => {
          if (next) onProviderChange(next);
        }}
        filter={(key, query) => filterProvider(key, query)}
      >
        <ComboboxTrigger id="ai-provider" size="lg">
          {providerLabel(selectedProvider)}
        </ComboboxTrigger>
        <ComboboxContent
          aria-label={t("admin.ai.provider")}
          search={<ComboboxSearch placeholder={t("admin.ai.search_provider")} />}
        >
          <ComboboxEmpty>{t("admin.ai.no_matching_providers")}</ComboboxEmpty>
          <ComboboxList aria-label={t("admin.ai.provider")}>
            {(key: string) => <ComboboxItem key={key} value={key} label={providerLabel(key)} />}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="pt-0.5 text-11 text-tertiary">{t("admin.ai.provider_description")}</p>
    </div>
  );
}

interface IAIModelFieldProps {
  t: TTranslate;
  control: Control<AIFormValues>;
  models: string[];
  onFetchModels: () => void;
  isFetchingModels: boolean;
  modelPlaceholder: string;
}

function AIModelField(props: IAIModelFieldProps) {
  const { t, control, models, onFetchModels, isFetchingModels, modelPlaceholder } = props;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="LLM_MODEL" className="text-13 text-tertiary">
        {t("admin.ai.llm_model")}
      </label>
      <div className="flex items-center gap-2">
        {/* Column flex stretches the picker trigger across the row (it is content-sized otherwise) */}
        <div className="flex min-w-0 grow flex-col">
          <Controller
            control={control}
            name="LLM_MODEL"
            render={({ field: { value, onChange } }) => (
              <ModelPicker
                id="LLM_MODEL"
                value={value ?? ""}
                onChange={onChange}
                models={models}
                placeholder={modelPlaceholder}
              />
            )}
          />
        </div>
        <Button
          variant="secondary"
          size="lg"
          stretch="auto"
          onClick={onFetchModels}
          loading={isFetchingModels}
          label={t("admin.ai.fetch_models")}
        />
      </div>
      <p className="pt-0.5 text-11 text-tertiary">
        {models.length > 0
          ? t("admin.ai.models_available", { count: models.length })
          : t("admin.ai.llm_model_description")}
      </p>
    </div>
  );
}

interface IAIFormActionsProps {
  t: TTranslate;
  onSave: () => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
}

function AIFormActions(props: IAIFormActionsProps) {
  const { t, onSave, onTest, isSubmitting, isTesting } = props;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="primary"
        size="md"
        stretch="auto"
        onClick={onSave}
        loading={isSubmitting}
        label={isSubmitting ? t("admin.common.saving") : t("admin.common.save_changes")}
      />
      <Button
        variant="secondary"
        size="md"
        stretch="auto"
        onClick={onTest}
        loading={isTesting}
        label={t("admin.ai.test_connection")}
      />
    </div>
  );
}

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  const { t } = useTranslation();
  // store
  const { updateInstanceConfigurations } = useInstance();
  // states
  const [models, setModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  // "Custom" is an explicit choice; otherwise the provider is inferred from the protocol and base URL
  const [isCustomProvider, setIsCustomProvider] = useState(false);
  // form data
  const {
    handleSubmit,
    control,
    getValues,
    setValue,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_PROVIDER: AI_PROTOCOLS.some((p) => p.key === config["LLM_PROVIDER"]) ? config["LLM_PROVIDER"] : "openai",
      LLM_BASE_URL: config["LLM_BASE_URL"] ?? "",
      // The backend only returns a masked hint of the saved key, so the field always starts empty
      LLM_API_KEY: "",
      LLM_MODEL: config["LLM_MODEL"],
    },
  });

  const protocol = useWatch({ control, name: "LLM_PROVIDER" }) as TInstanceAIProtocol;
  const baseUrl = useWatch({ control, name: "LLM_BASE_URL" });
  const protocolOption = getAIProtocol(protocol);
  const resolvedBaseUrl = resolveAIBaseUrl(protocol, baseUrl);
  // provider presets come from any-llm's registry on the backend
  const { data: providers } = useSWR("INSTANCE_AI_PROVIDERS", () => instanceService.listAIProviders());
  const selectedProvider = isCustomProvider
    ? CUSTOM_PROVIDER
    : (providers?.find((p) => p.protocol === protocol && p.base_url === (baseUrl ?? "").trim())?.key ??
      CUSTOM_PROVIDER);
  // Common providers carry a localized name (e.g. 硅基流动); the rest keep the brand name from any-llm
  const providerLabel = (key: string): string => {
    if (key === CUSTOM_PROVIDER) return t("admin.ai.custom_provider");
    if (TRANSLATED_AI_PROVIDERS.has(key)) return t(`admin.ai.provider_names.${key}`);
    return providers?.find((p) => p.key === key)?.label ?? key;
  };
  const providerKeys = [CUSTOM_PROVIDER, ...(providers ?? []).map((p) => p.key)];
  // Match the shown name, the English brand name and the key, so "kimi", "Moonshot" and "月之暗面" all work
  const matchesProvider = (key: string, query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const englishLabel = providers?.find((p) => p.key === key)?.label ?? "";
    return [providerLabel(key), englishLabel, key].some((text) => text.toLowerCase().includes(needle));
  };

  const handleProviderChange = (key: string) => {
    setModels([]);
    if (key === CUSTOM_PROVIDER) {
      // Keep the protocol and clear the URL so the admin types their own endpoint
      setIsCustomProvider(true);
      setValue("LLM_BASE_URL", "", { shouldDirty: true });
      return;
    }
    const preset = providers?.find((p) => p.key === key);
    if (!preset) return;
    setIsCustomProvider(false);
    setValue("LLM_PROVIDER", preset.protocol, { shouldDirty: true });
    setValue("LLM_BASE_URL", preset.base_url, { shouldDirty: true });
  };

  const connectionPayload = () => {
    const values = getValues();
    return {
      protocol: values.LLM_PROVIDER as TInstanceAIProtocol,
      base_url: values.LLM_BASE_URL,
      api_key: values.LLM_API_KEY,
      model: values.LLM_MODEL,
    };
  };

  const fetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const response = await instanceService.listAIModels(connectionPayload());
      setModels(response.models);
      setToast({
        type: "success",
        title: t("admin.common.success"),
        message: t("admin.ai.models_fetched", { count: response.models.length }),
      });
    } catch (error) {
      setToast({
        type: "error",
        title: t("admin.ai.models_fetch_failed"),
        message: getErrorMessage(error) ?? t("admin.ai.request_failed"),
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const response = await instanceService.testAIConnection(connectionPayload());
      setToast({
        type: "success",
        title: t("admin.ai.test_succeeded"),
        message: t("admin.ai.test_result", { model: response.model, latency: response.latency_ms }),
      });
    } catch (error) {
      setToast({
        type: "error",
        title: t("admin.ai.test_failed"),
        message: getErrorMessage(error) ?? t("admin.ai.request_failed"),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const savedKeyHint = config["LLM_API_KEY"] ?? "";

  const textFields: TControllerInputFormField<AIFormValues>[] = [
    {
      key: "LLM_BASE_URL",
      type: "text",
      label: t("admin.ai.base_url"),
      description: (
        <>
          {t("admin.ai.base_url_description")}
          {resolvedBaseUrl && (
            <span className="mt-1 block break-all">
              {t("admin.ai.base_url_preview")}{" "}
              <code className="text-secondary">
                {resolvedBaseUrl}
                {protocolOption.chatPath}
              </code>
            </span>
          )}
        </>
      ),
      placeholder: protocolOption.defaultBaseUrl,
      error: Boolean(errors.LLM_BASE_URL),
      required: false,
    },
    {
      key: "LLM_API_KEY",
      type: "password",
      label: t("admin.ai.api_key"),
      description: savedKeyHint
        ? t("admin.ai.api_key_saved_description", { key: savedKeyHint })
        : t("admin.ai.api_key_description"),
      placeholder: savedKeyHint || "sk-...",
      error: Boolean(errors.LLM_API_KEY),
      required: false,
    },
  ];

  const onSubmit = async (formData: AIFormValues) => {
    await updateInstanceConfigurations(formData)
      .then(() => {
        // Hide the key again; the new masked hint comes back with the saved configuration
        resetField("LLM_API_KEY", { defaultValue: "" });
        setToast({
          type: "success",
          title: t("admin.common.success"),
          message: t("admin.ai.toast_updated"),
        });
        return undefined;
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="grid w-full grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-2">
        <AIProviderField
          t={t}
          providerKeys={providerKeys}
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          filterProvider={matchesProvider}
          providerLabel={providerLabel}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="ai-protocol" className="text-13 text-tertiary">
            {t("admin.ai.protocol")}
          </label>
          <Controller
            control={control}
            name="LLM_PROVIDER"
            render={({ field: { value, onChange } }) => (
              <Select
                items={Object.fromEntries(AI_PROTOCOLS.map((p) => [p.key, t(p.i18nLabel)]))}
                value={value}
                onValueChange={(next) => {
                  onChange(next);
                  setModels([]);
                }}
              >
                <SelectTrigger id="ai-protocol" size="lg" />
                <SelectContent>
                  <SelectList>
                    {AI_PROTOCOLS.map((p) => (
                      <SelectItem key={p.key} value={p.key} label={t(p.i18nLabel)} size="lg" />
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            )}
          />
          <p className="pt-0.5 text-11 text-tertiary">{t("admin.ai.protocol_description")}</p>
        </div>

        {textFields.map((field) => (
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

        <AIModelField
          t={t}
          control={control}
          models={models}
          onFetchModels={fetchModels}
          isFetchingModels={isFetchingModels}
          modelPlaceholder={protocolOption.modelPlaceholder}
        />
      </div>

      <AIFormActions
        t={t}
        onSave={handleSubmit(onSubmit)}
        onTest={testConnection}
        isSubmitting={isSubmitting}
        isTesting={isTesting}
      />
    </div>
  );
}
