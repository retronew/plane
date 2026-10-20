/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { AiStar1Outline } from "@makeplane/propel/icons";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useInstance } from "@/hooks/store/use-instance";
import { AIService } from "@/services/ai.service";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { RESTRICTED_URLS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type { IWorkspace } from "@plane/types";
// ui
import { validateWorkspaceName } from "@plane/utils";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAppRouter } from "@/hooks/use-app-router";
// services
import { WorkspaceService } from "@/services/workspace.service";

type Props = {
  onSubmit?: (res: IWorkspace) => Promise<void>;
  defaultValues: {
    name: string;
    slug: string;
  };
  setDefaultValues: Dispatch<SetStateAction<Pick<IWorkspace, "name" | "slug">>>;
  secondaryButton?: React.ReactNode;
  primaryButtonText?: {
    loading: string;
    default: string;
  };
};

const workspaceService = new WorkspaceService();
const aiService = new AIService();
const normalizeWorkspaceSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const CreateWorkspaceForm = observer(function CreateWorkspaceForm(props: Props) {
  const { t } = useTranslation();
  const {
    onSubmit,
    defaultValues,
    setDefaultValues,
    secondaryButton,
    primaryButtonText = {
      loading: "workspace_creation.button.loading",
      default: "workspace_creation.button.default",
    },
  } = props;
  // states
  const [slugError, setSlugError] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const suggestionPending = useRef(false);
  const inputRevision = useRef(0);
  const { config } = useInstance();
  // router
  const router = useAppRouter();
  // store hooks
  const { createWorkspace } = useWorkspace();
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    setError,
    getValues,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<IWorkspace>({ defaultValues, mode: "onChange" });

  const workspaceName = watch("name");
  const handleSuggestSlug = async () => {
    const name = getValues("name");
    if (!name.trim() || suggestionPending.current) return;
    const revision = inputRevision.current;
    suggestionPending.current = true;
    setIsSuggesting(true);
    try {
      const { slug } = await aiService.suggestWorkspaceSlug(name);
      if (revision !== inputRevision.current) return;
      if (!/^[a-z0-9_-]{1,48}$/.test(slug) || RESTRICTED_URLS.includes(slug)) throw new Error("Invalid slug");
      const available = await workspaceService.workspaceSlugCheck(slug);
      if (revision !== inputRevision.current) return;
      if (!available.status) throw { status: 409 };
      setSlugError(false);
      setValue("slug", slug, { shouldValidate: true, shouldDirty: true });
    } catch (error) {
      if (revision !== inputRevision.current) return;
      setToast({
        type: "error",
        title: t("workspace_creation.toast.error.title"),
        message: t(
          error && typeof error === "object" && "status" in error && error.status === 409
            ? "workspace_creation.form.url.ai_taken"
            : "workspace_creation.form.url.ai_error"
        ),
      });
    } finally {
      suggestionPending.current = false;
      setIsSuggesting(false);
    }
  };

  const handleCreateWorkspace = async (formData: IWorkspace) => {
    try {
      const res = (await workspaceService.workspaceSlugCheck(formData.slug)) as { status: boolean };
      if (res.status === true && !RESTRICTED_URLS.includes(formData.slug)) {
        setSlugError(false);
        try {
          const workspaceResponse = await createWorkspace(formData);
          setToast({
            type: "success",
            title: t("workspace_creation.toast.success.title"),
            message: t("workspace_creation.toast.success.message"),
          });

          if (onSubmit) await onSubmit(workspaceResponse);
        } catch (error) {
          if (error && typeof error === "object") {
            let hasFieldError = false;
            for (const field of ["name", "slug"] as const) {
              if (!(field in error)) continue;
              const detail = (error as Record<string, unknown>)[field];
              const message = Array.isArray(detail) ? detail[0] : detail;
              if (typeof message === "string") {
                setError(field, { type: "server", message });
                hasFieldError = true;
              }
            }
            if (hasFieldError) return;
          }
          setToast({
            type: "error",
            title: t("workspace_creation.toast.error.title"),
            message: t("workspace_creation.toast.error.message"),
          });
        }
      } else {
        setSlugError(true);
      }
    } catch {
      setToast({
        type: "error",
        title: t("workspace_creation.toast.error.title"),
        message: t("workspace_creation.toast.error.message"),
      });
    }
  };

  useEffect(
    () => () => {
      // when the component unmounts set the default values to whatever user typed in
      setDefaultValues(getValues());
    },
    [getValues, setDefaultValues]
  );

  return (
    <form
      className="space-y-6 sm:space-y-9"
      onSubmit={(e) => {
        void handleSubmit(handleCreateWorkspace)(e);
      }}
    >
      <div className="space-y-6 sm:space-y-7">
        <div className="flex flex-col gap-2 text-body-xs-medium">
          <label htmlFor="workspaceName">
            {t("workspace_creation.form.name.label")}
            <span className="ml-0.5 text-danger-primary">*</span>
          </label>
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="name"
              rules={{
                required: t("common.errors.required"),
                validate: (value) => validateWorkspaceName(value, true),
                maxLength: {
                  value: 80,
                  message: t("workspace_creation.errors.validation.name_length"),
                },
              }}
              render={({ field: { value, ref, onChange } }) => (
                <Field name="workspaceName" invalid={Boolean(errors.name)}>
                  <InputGroup size="lg">
                    <Input
                      size="lg"
                      id="workspaceName"
                      type="text"
                      value={value}
                      onChange={(e) => {
                        inputRevision.current += 1;
                        onChange(e.target.value);
                        setValue("name", e.target.value);
                        setSlugError(false);
                        setValue("slug", normalizeWorkspaceSlug(e.target.value), {
                          shouldValidate: true,
                        });
                      }}
                      ref={ref}
                      placeholder={t("workspace_creation.form.name.placeholder")}
                    />
                  </InputGroup>
                </Field>
              )}
            />
            <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-body-xs-medium">
          <label htmlFor="workspaceUrl">
            {t("workspace_creation.form.url.label")}
            <span className="ml-0.5 text-danger-primary">*</span>
          </label>
          <Controller
            control={control}
            name="slug"
            rules={{
              required: t("workspace_creation.errors.validation.url_required"),
              validate: (value) =>
                /^[a-zA-Z0-9_-]+$/.test(value) || t("workspace_creation.errors.validation.url_alphanumeric"),
              maxLength: {
                value: 48,
                message: t("workspace_creation.errors.validation.url_length"),
              },
            }}
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <Field name="workspaceUrl" invalid={Boolean(errors.slug) || slugError}>
                <InputGroup size="lg">
                  <span className="mr-[calc(var(--control-gap-lg)*-1)] flex max-w-[50%] min-w-0 shrink-0 text-caption-md-regular text-secondary">
                    {window && window.location.host}/
                  </span>
                  <Input
                    size="lg"
                    id="workspaceUrl"
                    type="text"
                    value={value}
                    onChange={(e) => {
                      inputRevision.current += 1;
                      setSlugError(false);
                      onChange(e.target.value);
                    }}
                    onBlur={(e) => {
                      onBlur();
                      setValue("slug", normalizeWorkspaceSlug(e.target.value), {
                        shouldValidate: true,
                      });
                    }}
                    ref={ref}
                    placeholder={t("workspace_creation.form.url.placeholder")}
                  />
                  {config?.has_llm_configured && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      render={
                        <button
                          type="button"
                          aria-label={t("workspace_creation.form.url.ai_suggest")}
                          className="mr-[calc(3px-var(--field-inset-lg))]"
                        />
                      }
                      icon={<Icon icon={AiStar1Outline} />}
                      aria-label={t("workspace_creation.form.url.ai_suggest")}
                      title={t("workspace_creation.form.url.ai_suggest")}
                      aria-busy={isSuggesting}
                      disabled={!workspaceName?.trim() || isSuggesting || isSubmitting}
                      loading={isSuggesting}
                      onClick={() => void handleSuggestSlug()}
                    />
                  )}
                </InputGroup>
              </Field>
            )}
          />
          {slugError && (
            <p className="-mt-3 text-13 text-danger-primary">
              {t("workspace_creation.errors.validation.url_already_taken")}
            </p>
          )}
          {errors.slug && <span className="text-11 text-danger-primary">{errors.slug.message}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {secondaryButton}
        <Button
          variant="primary"
          type="submit"
          size="lg"
          stretch="auto"
          label={isSubmitting ? t(primaryButtonText.loading) : t(primaryButtonText.default)}
          disabled={!isValid || isSuggesting}
          loading={isSubmitting}
        />
        {!secondaryButton && (
          <Button
            variant="secondary"
            type="button"
            size="lg"
            stretch="auto"
            label={t("common.go_back")}
            onClick={() => router.back()}
          />
        )}
      </div>
    </form>
  );
});
