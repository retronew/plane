/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { WEB_BASE_URL, ORGANIZATION_SIZE, RESTRICTED_URLS } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { InstanceWorkspaceService } from "@plane/services";
import type { IWorkspace } from "@plane/types";
import { validateSlug, validateWorkspaceName } from "@plane/utils";
// components
import { setToast } from "@plane/blocks/toast";
// hooks
import { useWorkspace } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

const instanceWorkspaceService = new InstanceWorkspaceService();

export function WorkspaceCreateForm() {
  // router
  const router = useRouter();
  const { t } = useTranslation();
  // states
  const [slugError, setSlugError] = useState(false);
  const [invalidSlug, setInvalidSlug] = useState(false);
  const [defaultValues, setDefaultValues] = useState<Partial<IWorkspace>>({
    name: "",
    slug: "",
    organization_size: "",
  });
  // store hooks
  const { createWorkspace } = useWorkspace();
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<IWorkspace>({ defaultValues, mode: "onChange" });
  // derived values
  const [workspaceBaseURL, setWorkspaceBaseURL] = useState(() => encodeURI(WEB_BASE_URL || ""));

  useEffect(() => {
    if (!WEB_BASE_URL) {
      setWorkspaceBaseURL(encodeURI(window.location.origin + "/"));
    }
  }, []);

  const handleCreateWorkspace = async (formData: IWorkspace) => {
    await instanceWorkspaceService
      .slugCheck(formData.slug)
      .then(async (res) => {
        if (res.status === true && !RESTRICTED_URLS.includes(formData.slug)) {
          setSlugError(false);
          await createWorkspace(formData)
            .then(async () => {
              setToast({
                type: "success",
                title: t("admin.common.success_exclamation"),
                message: t("admin.workspace.create_page.toast_created"),
              });
              router.push(`/workspace`);
              return undefined;
            })
            .catch(() => {
              setToast({
                type: "error",
                title: t("admin.common.error_exclamation"),
                message: t("admin.workspace.create_page.toast_create_failed"),
              });
            });
        } else setSlugError(true);
        return undefined;
      })
      .catch(() => {
        setToast({
          type: "error",
          title: t("admin.common.error_exclamation"),
          message: t("admin.workspace.create_page.toast_create_error"),
        });
      });
  };

  useEffect(
    () => () => {
      // when the component unmounts set the default values to whatever user typed in
      setDefaultValues(getValues());
    },
    [getValues, setDefaultValues]
  );

  return (
    <div className="space-y-8">
      <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">{t("admin.workspace.create_page.name")}</h4>
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="name"
              rules={{
                validate: (value) => validateWorkspaceName(value, true),
              }}
              render={({ field: { value, ref, onChange } }) => (
                <InputGroup size="lg">
                  <Input
                    size="lg"
                    id="workspaceName"
                    type="text"
                    value={value}
                    onChange={(e) => {
                      onChange(e.target.value);
                      setValue("name", e.target.value);
                      setValue("slug", e.target.value.toLocaleLowerCase().trim().replace(/ /g, "-"), {
                        shouldValidate: true,
                      });
                    }}
                    ref={ref}
                    aria-invalid={Boolean(errors.name)}
                    data-invalid={errors.name ? true : undefined}
                    placeholder={t("admin.workspace.create_page.name_placeholder")}
                  />
                </InputGroup>
              )}
            />
            <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">{t("admin.workspace.create_page.url")}</h4>
          <Controller
            control={control}
            name="slug"
            rules={{
              validate: (value) => validateSlug(value),
            }}
            render={({ field: { onChange, value, ref } }) => (
              <InputGroup size="lg">
                <span className="text-13 whitespace-nowrap text-secondary">{workspaceBaseURL}</span>
                <Input
                  id="workspaceUrl"
                  type="text"
                  size="lg"
                  value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                  onChange={(e) => {
                    if (/^[a-zA-Z0-9_-]+$/.test(e.target.value)) setInvalidSlug(false);
                    else setInvalidSlug(true);
                    onChange(e.target.value.toLowerCase());
                  }}
                  ref={ref}
                  aria-invalid={Boolean(errors.slug)}
                  data-invalid={errors.slug ? true : undefined}
                  placeholder="workspace-name"
                />
              </InputGroup>
            )}
          />
          {slugError && <p className="text-13 text-danger-primary">{t("admin.workspace.create_page.url_taken")}</p>}
          {invalidSlug && <p className="text-13 text-danger-primary">{t("admin.workspace.create_page.url_invalid")}</p>}
          {errors.slug && <span className="text-11 text-danger-primary">{errors.slug.message}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">{t("admin.workspace.create_page.org_size")}</h4>
          <div className="w-full">
            <Controller
              name="organization_size"
              control={control}
              rules={{ required: t("admin.workspace.create_page.required") }}
              render={({ field: { value, onChange } }) => (
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger size="lg" placeholder={t("admin.workspace.create_page.select_range")} />
                  <SelectContent>
                    <SelectList>
                      {ORGANIZATION_SIZE.map((item) => (
                        <SelectItem key={item} value={item} label={item} size="lg" />
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.organization_size && (
              <span className="text-13 text-danger-primary">{errors.organization_size.message}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex max-w-4xl items-center gap-4 py-1">
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={handleSubmit(handleCreateWorkspace)}
          disabled={!isValid}
          loading={isSubmitting}
          label={isSubmitting ? t("admin.workspace.create_page.creating") : t("admin.workspace.create")}
        />
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          nativeButton={false}
          render={<Link href="/workspace" />}
          label={t("admin.common.go_back")}
        />
      </div>
    </div>
  );
}
