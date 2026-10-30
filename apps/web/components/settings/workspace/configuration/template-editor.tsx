import { STATE_ICON_PRESETS, stateIconLabel } from "@/components/project-states/icon-presets";
import type { TStateIcon } from "@plane/types";
import { CategoryColorPicker } from "./category-color-picker";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { Plus, Trash2 } from "lucide-react";
import { TemplatesOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { SettingsHeading } from "@/components/settings/heading";
import { RichTextEditor } from "@/components/editor/rich-text";
import {
  configurationKey,
  projectConfigurationKey,
  workspaceConfigurationService as service,
  type WorkspaceTemplate,
  type TemplateConfiguration,
  type TemplateOptions,
  type TemplateWorkItemChild,
} from "@/services/workspace-configuration.service";
import { ConfigurationSelect } from "./select";

type Draft = Omit<WorkspaceTemplate, "id"> & { id?: string };
const fresh = (kind: WorkspaceTemplate["kind"]): Draft => ({
  kind,
  name: "",
  short_description: "",
  title: "",
  description_html: "<p></p>",
  priority: "none",
  project: null,
  configuration: {},
});

function syncTemplateDraft(
  existing: WorkspaceTemplate | undefined,
  source: WorkspaceTemplate | undefined,
  setSource: (value: WorkspaceTemplate) => void,
  setDraft: (value: Draft) => void
) {
  if (!existing || source === existing) return;
  setSource(existing);
  const configuration = { ...existing.configuration };
  for (const key of ["states", "labels", "children", "work_items"] as const) {
    if (configuration[key])
      Object.assign(configuration, {
        [key]: configuration[key].map((entry) => Object.assign({}, entry, { client_id: crypto.randomUUID() })),
      });
  }
  setDraft({ ...existing, configuration });
}

type SaveTemplateArgs = {
  event: FormEvent;
  busy: boolean;
  draft: Draft;
  existing: WorkspaceTemplate | undefined;
  workspaceSlug: string;
  reload: (key: string) => Promise<unknown>;
  back: () => void;
  setBusy: (value: boolean) => void;
  setMessage: (value: string) => void;
  errorMessage: string;
};

async function saveTemplate({
  event,
  busy,
  draft,
  existing,
  workspaceSlug,
  reload,
  back,
  setBusy,
  setMessage,
  errorMessage,
}: SaveTemplateArgs) {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  setMessage("");
  try {
    await service.save(workspaceSlug, "templates", draft);
    await Promise.all([
      reload(configurationKey(workspaceSlug, "templates")),
      ...(draft.project ? [reload(projectConfigurationKey(workspaceSlug, draft.project))] : []),
      ...(existing?.project && existing.project !== draft.project
        ? [reload(projectConfigurationKey(workspaceSlug, existing.project))]
        : []),
    ]);
    back();
  } catch {
    setMessage(errorMessage);
  } finally {
    setBusy(false);
  }
}

export function TemplateEditor() {
  const { workspaceSlug = "", templateKind = "", templateId } = useParams();
  const kind = templateKind === "work-item" ? "work_item" : templateKind;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const { allowPermissions } = useUserPermissions();
  const { getWorkspaceBySlug } = useWorkspace();
  const validKind = kind === "project" || kind === "work_item" || kind === "page";
  const [draft, setDraft] = useState<Draft>(() => fresh(validKind ? kind : "page"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { data: existing, error } = useSWR(templateId ? `template:${workspaceSlug}:${templateId}` : null, () =>
    service.template(workspaceSlug, templateId!)
  );
  const { data: options, error: optionsError } = useSWR(
    `template-options:${workspaceSlug}:${draft.project ?? ""}`,
    () => service.templateOptions(workspaceSlug, draft.project ?? undefined)
  );
  const [source, setSource] = useState<WorkspaceTemplate>();
  syncTemplateDraft(existing, source, setSource, setDraft);
  const config = draft.configuration;
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const configure = (patch: Partial<TemplateConfiguration>) =>
    setDraft((d) => ({ ...d, configuration: { ...d.configuration, ...patch } }));
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";
  const back = () => navigate(`/${workspaceSlug}/settings/templates/`);
  const save = (event: FormEvent) =>
    saveTemplate({
      event,
      busy,
      draft,
      existing,
      workspaceSlug,
      reload: (key) => mutate(key),
      back,
      setBusy,
      setMessage,
      errorMessage: t("web.configuration_save_error"),
    });
  if (!allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE))
    return <NotAuthorizedView section="settings" className="h-auto" />;
  if (!validKind) return <p>{t("web.configuration_load_error")}</p>;
  return (
    <TemplateEditorView
      workspaceSlug={workspaceSlug}
      kind={kind}
      validKind={validKind}
      templateId={templateId}
      error={error}
      existing={existing}
      options={options}
      optionsError={optionsError}
      draft={draft}
      config={config}
      busy={busy}
      message={message}
      workspaceId={workspaceId}
      update={update}
      configure={configure}
      onSubmit={save}
      onBack={back}
      onRetry={() => void mutate(`template:${workspaceSlug}:${templateId}`)}
    />
  );
}

type TemplateEditorViewProps = {
  workspaceSlug: string;
  kind: WorkspaceTemplate["kind"];
  validKind: boolean;
  templateId: string | undefined;
  error: unknown;
  existing: WorkspaceTemplate | undefined;
  options: TemplateOptions | undefined;
  optionsError: unknown;
  draft: Draft;
  config: TemplateConfiguration;
  busy: boolean;
  message: string;
  workspaceId: string;
  update: (patch: Partial<Draft>) => void;
  configure: (patch: Partial<TemplateConfiguration>) => void;
  onSubmit: (event: FormEvent) => void;
  onBack: () => void;
  onRetry: () => void;
};

function TemplateEditorView({
  workspaceSlug,
  kind,
  validKind,
  templateId,
  error,
  existing,
  options,
  optionsError,
  draft,
  config,
  busy,
  message,
  workspaceId,
  update,
  configure,
  onSubmit,
  onBack,
  onRetry,
}: TemplateEditorViewProps) {
  const { t } = useTranslation();
  const heading = t(`web.${templateId ? "edit" : "new"}_template_${validKind ? kind : "page"}`);
  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          breadcrumbs={[
            {
              label: t("web.templates"),
              href: `/${workspaceSlug}/settings/templates/`,
              icon: <TemplatesOutline className="size-4 text-tertiary" />,
            },
            { label: heading },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-7">
        <SettingsHeading title={heading} />
        {error ? (
          <div className="flex gap-3">
            <span>{t("web.configuration_load_error")}</span>
            <Button stretch="auto" size="md" variant="secondary" label={t("common.retry")} onClick={onRetry} />
          </div>
        ) : templateId && !existing ? (
          <p aria-busy="true">{t("loading")}</p>
        ) : (
          <TemplateForm
            kind={kind}
            templateId={templateId}
            draft={draft}
            config={config}
            options={options}
            optionsError={optionsError}
            message={message}
            busy={busy}
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            update={update}
            configure={configure}
            onSubmit={onSubmit}
            onBack={onBack}
          />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

type TemplateFormProps = {
  kind: WorkspaceTemplate["kind"];
  templateId: string | undefined;
  draft: Draft;
  config: TemplateConfiguration;
  options: TemplateOptions | undefined;
  optionsError: unknown;
  message: string;
  busy: boolean;
  workspaceSlug: string;
  workspaceId: string;
  update: (patch: Partial<Draft>) => void;
  configure: (patch: Partial<TemplateConfiguration>) => void;
  onSubmit: (event: FormEvent) => void;
  onBack: () => void;
};

function TemplateForm({
  kind,
  templateId,
  draft,
  config,
  options,
  optionsError,
  message,
  busy,
  workspaceSlug,
  workspaceId,
  update,
  configure,
  onSubmit,
  onBack,
}: TemplateFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        <TemplateBasicsFields draft={draft} update={update} />
        <div className="flex flex-col gap-5 rounded-lg border border-subtle bg-surface-1 p-5">
          <TemplateCoreFields
            kind={kind}
            templateId={templateId}
            draft={draft}
            config={config}
            options={options}
            workspaceSlug={workspaceSlug}
            workspaceId={workspaceId}
            update={update}
            configure={configure}
          />
          <TemplateKindFields
            kind={kind}
            draft={draft}
            config={config}
            options={options}
            update={update}
            configure={configure}
          />
        </div>
      </fieldset>
      <TemplateFormFooter
        kind={kind}
        templateId={templateId}
        draft={draft}
        busy={busy}
        message={message}
        optionsError={optionsError}
        onBack={onBack}
      />
    </form>
  );
}

function TemplateBasicsFields({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <InputField
        name="template.name"
        orientation="vertical"
        size="lg"
        label={t("web.template_name")}
        placeholder={t("web.template_name_placeholder")}
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      <label className="flex flex-col gap-2 text-13">
        {t("description")}
        <textarea
          name="template.short_description"
          className="min-h-20 resize-y rounded-md border border-subtle bg-layer-2 px-3 py-2 outline-none focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
          maxLength={1000}
          placeholder={t("web.template_summary_hint")}
          value={draft.short_description}
          onChange={(e) => update({ short_description: e.target.value })}
        />
      </label>
    </div>
  );
}

type TemplateCoreFieldsProps = {
  kind: WorkspaceTemplate["kind"];
  templateId: string | undefined;
  draft: Draft;
  config: TemplateConfiguration;
  options: TemplateOptions | undefined;
  workspaceSlug: string;
  workspaceId: string;
  update: (patch: Partial<Draft>) => void;
  configure: (patch: Partial<TemplateConfiguration>) => void;
};

function TemplateCoreFields({
  kind,
  templateId,
  draft,
  config,
  options,
  workspaceSlug,
  workspaceId,
  update,
  configure,
}: TemplateCoreFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      {kind === "work_item" && (
        <div className="w-60">
          <ConfigurationSelect
            value={draft.project ?? ""}
            placeholder={t("common.project")}
            options={(options?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
            onChange={(project) => update({ project, configuration: { children: config.children ?? [] } })}
          />
        </div>
      )}
      <InputField
        name="template.title"
        size="lg"
        orientation="vertical"
        label={t(kind === "project" ? "web.template_project_name" : "web.template_title")}
        maxLength={255}
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
      />
      {kind === "project" ? (
        <TemplateProjectDetailsFields config={config} options={options} configure={configure} />
      ) : (
        <TemplatePageBody
          draft={draft}
          templateId={templateId}
          kind={kind}
          workspaceSlug={workspaceSlug}
          workspaceId={workspaceId}
          update={update}
        />
      )}
    </>
  );
}

function TemplateProjectDetailsFields({
  config,
  options,
  configure,
}: {
  config: TemplateConfiguration;
  options: TemplateOptions | undefined;
  configure: (patch: Partial<TemplateConfiguration>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-2 text-13">
        {t("description")}
        <textarea
          className="min-h-24 rounded-md border border-subtle bg-layer-2 p-3 outline-none focus:border-accent-strong"
          value={config.description ?? ""}
          maxLength={10000}
          onChange={(e) => configure({ description: e.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConfigurationSelect
          value={String(config.network ?? 2)}
          placeholder={t("web.template_visibility")}
          options={[
            { value: "2", label: t("common.access.public") },
            { value: "0", label: t("common.access.private") },
          ]}
          onChange={(v) => configure({ network: v === "0" ? 0 : 2 })}
        />
        <ConfigurationSelect
          value={config.project_lead ?? "none"}
          placeholder={t("web.template_lead")}
          options={[
            { value: "none", label: t("web.template_no_lead") },
            ...(options?.members ?? []).map((m) => ({
              value: m.member_id,
              label: m.member__display_name,
            })),
          ]}
          onChange={(v) => configure({ project_lead: v === "none" ? null : v })}
        />
      </div>
    </>
  );
}

function TemplatePageBody({
  draft,
  templateId,
  kind,
  workspaceSlug,
  workspaceId,
  update,
}: {
  draft: Draft;
  templateId: string | undefined;
  kind: WorkspaceTemplate["kind"];
  workspaceSlug: string;
  workspaceId: string;
  update: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="min-h-48 rounded-md border border-subtle">
      <RichTextEditor
        key={templateId ?? kind}
        editable
        id="workspace-template-editor"
        initialValue={draft.description_html}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceId}
        disabledExtensions={["image", "issue-embed", "slash-commands"]}
        onChange={(_json, html) => update({ description_html: html })}
        searchMentionCallback={async () => ({})}
        uploadFile={async () => {
          throw new Error("Template attachments are not supported");
        }}
        duplicateFile={async () => {
          throw new Error("Template attachments are not supported");
        }}
      />
    </div>
  );
}

type TemplateKindFieldsProps = {
  kind: WorkspaceTemplate["kind"];
  draft: Draft;
  config: TemplateConfiguration;
  options: TemplateOptions | undefined;
  update: (patch: Partial<Draft>) => void;
  configure: (patch: Partial<TemplateConfiguration>) => void;
};

function TemplateKindFields({ kind, draft, config, options, update, configure }: TemplateKindFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      {kind === "work_item" && (
        <TemplateWorkItemFields draft={draft} config={config} options={options} configure={configure} update={update} />
      )}
      {kind === "project" && (
        <>
          <label className="flex items-center justify-between gap-3 text-13">
            <span>{t("web.default_state_template")}</span>
            <Switch
              size="md"
              checked={draft.is_default_state_template ?? false}
              onCheckedChange={(value) => update({ is_default_state_template: value })}
            />
          </label>
          <TemplateProjectFeatures config={config} configure={configure} />
          {(["states", "labels"] as const).map((key) => (
            <TemplateCategoryDetails key={key} fieldKey={key} config={config} configure={configure} />
          ))}
          <TemplateChildrenField
            fieldKey="work_items"
            items={config.work_items ?? []}
            onChange={(work_items) => configure({ work_items })}
          />
        </>
      )}
    </>
  );
}

type TemplateFormFooterProps = {
  kind: WorkspaceTemplate["kind"];
  templateId: string | undefined;
  draft: Draft;
  busy: boolean;
  message: string;
  optionsError: unknown;
  onBack: () => void;
};

function TemplateFormFooter({ kind, templateId, draft, busy, message, optionsError, onBack }: TemplateFormFooterProps) {
  const { t } = useTranslation();
  return (
    <>
      {(message || optionsError) && (
        <p role="alert" className="text-13 text-danger-primary">
          {message || t("web.configuration_load_error")}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button stretch="auto" size="md" variant="secondary" label={t("cancel")} disabled={busy} onClick={onBack} />
        <Button
          stretch="auto"
          size="md"
          variant="primary"
          type="submit"
          label={t(templateId ? "save" : `web.create_template_${kind}`)}
          loading={busy}
          disabled={!draft.name.trim() || busy || !!optionsError}
        />
      </div>
    </>
  );
}

type TemplateMultiSelectProps = {
  label: string;
  entries: { id: string; name: string }[];
  selected?: string[];
  onChange: (ids: string[]) => void;
};
function TemplateMultiSelect({ label, entries, selected, onChange }: TemplateMultiSelectProps) {
  const { t } = useTranslation();
  const selectedIds = new Set(selected);
  return (
    <details className="rounded-md border border-subtle p-2">
      <summary className="cursor-pointer text-13">
        {label}
        {selected?.length ? ` (${selected.length})` : ""}
      </summary>
      <div className="flex flex-col gap-2 pt-3">
        {entries.map((entry) => (
          <Checkbox
            key={entry.id}
            label={entry.name}
            checked={selectedIds.has(entry.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...new Set([...(selected ?? []), entry.id])]
                  : (selected ?? []).filter((id) => id !== entry.id)
              )
            }
          />
        ))}
        {!entries.length && <p className="text-12 text-tertiary">{t("web.configuration_empty")}</p>}
      </div>
    </details>
  );
}

type TemplateChildrenFieldProps = {
  fieldKey: "children" | "work_items";
  items: TemplateWorkItemChild[];
  onChange: (items: TemplateWorkItemChild[]) => void;
};
function TemplateChildrenField({ fieldKey, items, onChange }: TemplateChildrenFieldProps) {
  const { t } = useTranslation();
  return (
    <details className="rounded-lg border border-subtle p-4">
      <summary className="cursor-pointer text-13 font-medium">
        {t(fieldKey === "children" ? "web.template_sub_work_items" : "web.template_work_items")}
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={item.client_id} className="flex items-start gap-2">
            <div className="flex-1">
              <InputField
                orientation="vertical"
                size="md"
                aria-label={t("web.title")}
                placeholder={t("web.title")}
                required
                value={item.name}
                maxLength={255}
                onChange={(e) =>
                  onChange(
                    items.map((entry, i) => (i === index ? Object.assign({}, entry, { name: e.target.value }) : entry))
                  )
                }
              />
            </div>
            <Button
              stretch="auto"
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3" />}
              label={t("delete")}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          stretch="auto"
          size="md"
          variant="secondary"
          icon={<Plus className="size-3.5" />}
          label={t("add")}
          disabled={items.length >= 50}
          onClick={() =>
            onChange([...items, { client_id: crypto.randomUUID(), name: "", description_html: "<p></p>" }])
          }
        />
      </div>
    </details>
  );
}

type TemplateWorkItemFieldsProps = {
  draft: Draft;
  config: TemplateConfiguration;
  options?: TemplateOptions;
  configure: (patch: Partial<TemplateConfiguration>) => void;
  update: (patch: Partial<Draft>) => void;
};
function TemplateWorkItemFields({ draft, config, options, configure, update }: TemplateWorkItemFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConfigurationSelect
          value={config.state_id ?? "none"}
          placeholder={t("state")}
          options={[
            { value: "none", label: t("web.template_default_state") },
            ...(options?.states ?? []).map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={(state) => configure({ state_id: state === "none" ? null : state })}
        />
        <ConfigurationSelect
          value={draft.priority}
          placeholder={t("priority")}
          options={["none", "low", "medium", "high", "urgent"].map((value) => ({
            value,
            label: t(value),
          }))}
          onChange={(priority) => update({ priority: priority as WorkspaceTemplate["priority"] })}
        />
      </div>
      {draft.project && (
        <div className="grid gap-3 sm:grid-cols-3">
          <TemplateMultiSelect
            label={t("assignees")}
            entries={(options?.assignees ?? []).map((m) => ({ id: m.member_id, name: m.member__display_name }))}
            selected={config.assignee_ids}
            onChange={(assignee_ids) => configure({ assignee_ids })}
          />
          <TemplateMultiSelect
            label={t("labels")}
            entries={options?.labels ?? []}
            selected={config.label_ids}
            onChange={(label_ids) => configure({ label_ids })}
          />
          <TemplateMultiSelect
            label={t("modules")}
            entries={options?.modules ?? []}
            selected={config.module_ids}
            onChange={(module_ids) => configure({ module_ids })}
          />
        </div>
      )}
      <TemplateChildrenField
        fieldKey="children"
        items={config.children ?? []}
        onChange={(children) => configure({ children })}
      />
    </>
  );
}

type TemplateProjectFeaturesProps = {
  config: TemplateConfiguration;
  configure: (patch: Partial<TemplateConfiguration>) => void;
};
function TemplateProjectFeatures({ config, configure }: TemplateProjectFeaturesProps) {
  const { t } = useTranslation();
  return (
    <details className="rounded-lg border border-subtle p-4">
      <summary className="cursor-pointer text-13 font-medium">{t("web.template_features")}</summary>
      <div className="mt-4 flex flex-col gap-4">
        {(["cycle_view", "module_view", "page_view", "issue_views_view", "intake_view"] as const).map((field) => (
          <div key={field} className="flex items-center justify-between">
            <label htmlFor={field} className="text-13">
              {t(`web.template_feature_${field}`)}
            </label>
            <Switch
              id={field}
              size="md"
              checked={config[field] ?? field === "page_view"}
              onCheckedChange={(value) => configure({ [field]: value })}
            />
          </div>
        ))}
      </div>
    </details>
  );
}

type TemplateCategoryDetailsProps = {
  fieldKey: "states" | "labels";
  config: TemplateConfiguration;
  configure: (patch: Partial<TemplateConfiguration>) => void;
};
function TemplateCategoryDetails({ fieldKey, config, configure }: TemplateCategoryDetailsProps) {
  const { t } = useTranslation();
  return (
    <details className="rounded-lg border border-subtle p-4">
      <summary className="cursor-pointer text-13 font-medium">
        {t(fieldKey === "states" ? "web.template_states" : "labels")}
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        {fieldKey === "states" && (
          <div className="flex flex-col gap-2">
            {["backlog", "unstarted", "started", "completed", "cancelled"].map((group) => (
              <label key={group} className="flex items-center justify-between gap-3 text-13">
                {t(`web.template_state_${group}`)}
                <Switch
                  size="sm"
                  aria-label={`${t("web.allow_new_work_items")} · ${t(`web.template_state_${group}`)}`}
                  checked={!config.disabled_state_groups?.includes(group)}
                  onCheckedChange={(checked) =>
                    configure({
                      disabled_state_groups: checked
                        ? (config.disabled_state_groups ?? []).filter((value) => value !== group)
                        : [...(config.disabled_state_groups ?? []), group],
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
        {(config[fieldKey] ?? []).map((entry, index) => (
          <div key={entry.client_id} className="flex flex-wrap items-center gap-2">
            <CategoryColorPicker
              kind={fieldKey === "states" ? "status" : "label"}
              value={entry.color}
              onChange={(color) =>
                configure({
                  [fieldKey]: (config[fieldKey] ?? []).map((item, i) =>
                    i === index ? Object.assign({}, item, { color }) : item
                  ),
                })
              }
            />
            <div className="min-w-32 flex-1">
              <InputField
                size="md"
                orientation="vertical"
                aria-label={t("name")}
                required
                maxLength={100}
                value={entry.name}
                onChange={(e) =>
                  configure({
                    [fieldKey]: (config[fieldKey] ?? []).map((item, i) =>
                      i === index ? Object.assign({}, item, { name: e.target.value }) : item
                    ),
                  })
                }
              />
            </div>
            {fieldKey === "states" && (
              <div className="w-36">
                <ConfigurationSelect
                  value={config.states?.[index].group ?? "unstarted"}
                  placeholder={t("state")}
                  options={["backlog", "unstarted", "started", "completed", "cancelled"].map((value) => ({
                    value,
                    label: t(`web.template_state_${value}`),
                  }))}
                  onChange={(group) =>
                    configure({
                      states: config.states?.map((item, i) =>
                        i === index ? Object.assign({}, item, { group }) : item
                      ),
                    })
                  }
                />
              </div>
            )}
            {fieldKey === "states" && (
              <>
                <div className="w-36">
                  <ConfigurationSelect
                    value={config.states?.[index].icon ?? "auto"}
                    placeholder={t("web.state_icon")}
                    options={STATE_ICON_PRESETS.map((icon) => ({
                      value: icon ?? "auto",
                      label: t(stateIconLabel(icon)),
                    }))}
                    onChange={(value) =>
                      configure({
                        states: config.states?.map((item, i) =>
                          i === index ? { ...item, icon: value === "auto" ? null : (value as TStateIcon) } : item
                        ),
                      })
                    }
                  />
                </div>
                <Checkbox
                  label={t("web.template_default_state")}
                  checked={config.states?.[index].default ?? false}
                  onCheckedChange={(checked) =>
                    configure({
                      states: config.states?.map((state, i) => ({
                        ...state,
                        default: i === index ? !!checked : false,
                      })),
                    })
                  }
                />
                <label className="flex items-center gap-2 text-12">
                  {t("web.allow_new_work_items")}
                  <Switch
                    size="sm"
                    checked={config.states?.[index].allow_new_work_items !== false}
                    onCheckedChange={(checked) =>
                      configure({
                        states: config.states?.map((state, i) =>
                          i === index ? { ...state, allow_new_work_items: checked } : state
                        ),
                      })
                    }
                  />
                </label>
              </>
            )}
            <Button
              stretch="auto"
              size="sm"
              variant="ghost"
              label={t("delete")}
              onClick={() => configure({ [fieldKey]: (config[fieldKey] ?? []).filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        <Button
          stretch="auto"
          size="md"
          variant="secondary"
          label={t(fieldKey === "states" ? "web.add_project_status" : "web.add_project_label")}
          onClick={() =>
            configure({
              [fieldKey]: [
                ...(config[fieldKey] ?? []),
                ...(fieldKey === "states"
                  ? [
                      {
                        client_id: crypto.randomUUID(),
                        name: "",
                        color: "#60646C",
                        group: "unstarted",
                        default: !config.states?.length,
                      },
                    ]
                  : [{ client_id: crypto.randomUUID(), name: "", color: "#60646C" }]),
              ],
            })
          }
        />
      </div>
    </details>
  );
}
