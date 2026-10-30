/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ChangeEvent } from "react";
import { ProjectCreateLogo } from "./header";
import type { UseFormSetValue } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { RichTextEditor } from "@/components/editor/rich-text";
import { projectDescriptionToHTML, projectDescriptionToMarkdown } from "@/helpers/project-description";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { WorkspaceService } from "@/services/workspace.service";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InfoOutline } from "@makeplane/propel/icons";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TProject } from "@plane/types";
// ui
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { projectIdentifierSanitizer, getTabIndex } from "@plane/utils";

type Props = {
  setValue: UseFormSetValue<TProject>;
  isMobile: boolean;
  shouldAutoSyncIdentifier: boolean;
  setShouldAutoSyncIdentifier: (value: boolean) => void;
  handleFormOnChange?: () => void;
};

function ProjectCommonAttributes(props: Props) {
  const { setValue, isMobile, shouldAutoSyncIdentifier, setShouldAutoSyncIdentifier, handleFormOnChange } = props;
  const {
    formState: { errors },
    control,
  } = useFormContext<TProject>();

  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  const { t } = useTranslation();

  const handleNameChange =
    (onChange: (event: ChangeEvent<HTMLInputElement>) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      if (!shouldAutoSyncIdentifier) {
        onChange(e);
        return;
      }
      if (e.target.value === "") setValue("identifier", "");
      else setValue("identifier", projectIdentifierSanitizer(e.target.value).substring(0, 10));
      onChange(e);
      handleFormOnChange?.();
    };

  const handleIdentifierChange = (onChange: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const alphanumericValue = projectIdentifierSanitizer(value);
    setShouldAutoSyncIdentifier(false);
    onChange(alphanumericValue);
    handleFormOnChange?.();
  };
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <ProjectCreateLogo handleFormOnChange={handleFormOnChange} />
        <div className="min-w-0 flex-1">
          <Controller
            control={control}
            name="name"
            rules={{
              required: t("name_is_required"),
              maxLength: {
                value: 255,
                message: t("title_should_be_less_than_255_characters"),
              },
            }}
            render={({ field: { value, onChange, ref } }) => (
              <Field name="name" invalid={Boolean(errors.name)}>
                <InputGroup
                  size="lg"
                  render={
                    <div className="h-10! shrink-0 rounded-lg! border-0! bg-layer-1! px-3! shadow-none! ring-0! outline-none! focus-within:border-0! focus-within:ring-0!" />
                  }
                >
                  <Input
                    size="2xl"
                    render={
                      <input className="h-full! w-full border-0! bg-transparent! p-0! text-18! leading-7! font-semibold! shadow-none! ring-0! outline-none! placeholder:text-[lch(66_1_282)]! focus:ring-0! focus-visible:ring-0!" />
                    }
                    aria-label={t("project_name")}
                    ref={ref}
                    aria-invalid={Boolean(errors.name)}
                    id="name"
                    name="name"
                    type="text"
                    value={value}
                    onChange={handleNameChange(onChange)}
                    placeholder={t("project_name")}
                    tabIndex={getIndex("name")}
                  />
                </InputGroup>
              </Field>
            )}
          />
        </div>
      </div>
      <div className="relative w-36 shrink-0">
        <Controller
          control={control}
          name="identifier"
          rules={{
            required: t("project_id_is_required"),
            // allow only alphanumeric & non-latin characters
            validate: (value) =>
              /^[ÇŞĞIİÖÜA-Z0-9]+$/.test(value.toUpperCase()) || t("only_alphanumeric_non_latin_characters_allowed"),
            minLength: {
              value: 1,
              message: t("project_id_min_char"),
            },
            maxLength: {
              value: 12,
              message: t("project_id_max_char", { max: 12 }),
            },
          }}
          render={({ field: { value, onChange, ref } }) => (
            <Field name="identifier" invalid={Boolean(errors.identifier)}>
              <InputGroup
                size="md"
                render={
                  <div className="h-10! rounded-lg! border-0! bg-layer-1! px-3! shadow-none! ring-0! outline-none! focus-within:border-0! focus-within:ring-0!" />
                }
              >
                <Input
                  size="md"
                  render={
                    <input className="border-0! bg-transparent! p-0! shadow-none! ring-0! outline-none! placeholder:text-[lch(66_1_282)]! focus:ring-0! focus-visible:ring-0!" />
                  }
                  aria-label={t("project_id")}
                  ref={ref}
                  aria-invalid={Boolean(errors.identifier)}
                  id="identifier"
                  name="identifier"
                  type="text"
                  value={value}
                  onChange={handleIdentifierChange(onChange)}
                  placeholder={t("project_id")}
                  tabIndex={getIndex("identifier")}
                />
                <Tooltip label={t("project_id_tooltip_content")} side="top" align="center" disabled={isMobile}>
                  <IconButton
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={t("project_id_tooltip_content")}
                    icon={<InfoOutline />}
                  />
                </Tooltip>
              </InputGroup>
            </Field>
          )}
        />
      </div>
    </div>
  );
}

export function ProjectCreateDescription({
  isMobile,
  workspaceSlug,
  handleFormOnChange,
}: {
  isMobile: boolean;
  workspaceSlug: string;
  handleFormOnChange?: () => void;
}) {
  const { control, setValue, watch } = useFormContext<TProject>();
  const { getWorkspaceBySlug } = useWorkspace();
  const { t } = useTranslation();
  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  const description = watch("description");
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";
  return (
    <div className="issue-composer-description">
      <Controller
        name="description_html"
        control={control}
        render={({ field: { value, onChange } }) => (
          <RichTextEditor
            editable
            id="project-create-description"
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            initialValue={value ?? projectDescriptionToHTML(description ?? "")}
            value={value ?? projectDescriptionToHTML(description ?? "")}
            disabledExtensions={["image", "issue-embed"]}
            containerClassName="issue-composer-editor min-h-[140px] rounded-lg bg-layer-1 border-0! p-3! shadow-none! ring-0! [--color-placeholder:lch(66_1_282)] [--font-size-regular:14px] [&_.tiptap]:text-14! [&_.tiptap]:leading-6! [&_.tiptap]:min-h-[140px] [&_.tiptap]:border-0 [&_.tiptap]:outline-none [&_.tiptap]:ring-0"
            placeholder={t("description")}
            tabIndex={getIndex("description")}
            onChange={(json, html) => {
              onChange(html);
              setValue("description_text", json, { shouldDirty: true });
              setValue("description", projectDescriptionToMarkdown(html), { shouldDirty: true });
              handleFormOnChange?.();
            }}
            searchMentionCallback={(payload) => new WorkspaceService().searchEntity(workspaceSlug, payload)}
            uploadFile={async () => {
              throw new Error("Project creation does not support image uploads.");
            }}
            duplicateFile={async () => {
              throw new Error("Project creation does not support image uploads.");
            }}
          />
        )}
      />
    </div>
  );
}

export default ProjectCommonAttributes;
