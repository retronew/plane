import { CategoryColorPicker } from "./category-color-picker";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
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
  if (existing && source !== existing) {
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
  const config = draft.configuration;
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const configure = (patch: Partial<TemplateConfiguration>) =>
    setDraft((d) => ({ ...d, configuration: { ...d.configuration, ...patch } }));
  const heading = t(`web.${templateId ? "edit" : "new"}_template_${validKind ? kind : "page"}`);
  const back = () => navigate(`/${workspaceSlug}/settings/templates/`);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await service.save(workspaceSlug, "templates", draft);
      await Promise.all([
        mutate(configurationKey(workspaceSlug, "templates")),
        ...(draft.project ? [mutate(projectConfigurationKey(workspaceSlug, draft.project))] : []),
        ...(existing?.project && existing.project !== draft.project
          ? [mutate(projectConfigurationKey(workspaceSlug, existing.project))]
          : []),
      ]);
      back();
    } catch {
      setMessage(t("web.configuration_save_error"));
    } finally {
      setBusy(false);
    }
  };
  const multi = (
    label: string,
    entries: { id: string; name: string }[],
    key: "assignee_ids" | "label_ids" | "module_ids"
  ) => (
    <details className="rounded-md border border-subtle p-2">
      <summary className="cursor-pointer text-13">
        {label}
        {config[key]?.length ? ` (${config[key]!.length})` : ""}
      </summary>
      <div className="flex flex-col gap-2 pt-3">
        {entries.map((entry) => (
          <Checkbox
            key={entry.id}
            label={entry.name}
            checked={config[key]?.includes(entry.id) ?? false}
            onCheckedChange={(checked) =>
              configure({
                [key]: checked
                  ? [...new Set([...(config[key] ?? []), entry.id])]
                  : (config[key] ?? []).filter((id) => id !== entry.id),
              })
            }
          />
        ))}
        {!entries.length && <p className="text-12 text-tertiary">{t("web.configuration_empty")}</p>}
      </div>
    </details>
  );
  const children = (key: "children" | "work_items") => (
    <details className="rounded-lg border border-subtle p-4">
      <summary className="cursor-pointer text-13 font-medium">
        {t(key === "children" ? "web.template_sub_work_items" : "web.template_work_items")}
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        {(config[key] ?? []).map((item, index) => (
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
                  configure({
                    [key]: (config[key] ?? []).map((entry, i) =>
                      i === index ? Object.assign({}, entry, { name: e.target.value }) : entry
                    ),
                  })
                }
              />
            </div>
            <Button
              stretch="auto"
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-3" />}
              label={t("delete")}
              onClick={() => configure({ [key]: (config[key] ?? []).filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        <Button
          stretch="auto"
          size="md"
          variant="secondary"
          icon={<Plus className="size-3.5" />}
          label={t("add")}
          disabled={(config[key]?.length ?? 0) >= 50}
          onClick={() =>
            configure({
              [key]: [
                ...(config[key] ?? []),
                { client_id: crypto.randomUUID(), name: "", description_html: "<p></p>" },
              ],
            })
          }
        />
      </div>
    </details>
  );
  if (!allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE))
    return <NotAuthorizedView section="settings" className="h-auto" />;
  if (!validKind) return <p>{t("web.configuration_load_error")}</p>;
  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          leftItem={
            <nav aria-label={t("web.templates")} className="flex items-center gap-2 text-13">
              <Link to={`/${workspaceSlug}/settings/templates/`} className="flex items-center gap-2">
                <TemplatesOutline className="size-4" />
                {t("web.templates")}
              </Link>
              <ChevronRight className="size-3 text-tertiary" />
              <span>{heading}</span>
            </nav>
          }
        />
      }
    >
      <div className="flex flex-col gap-7">
        <SettingsHeading title={heading} />
        {error ? (
          <div className="flex gap-3">
            <span>{t("web.configuration_load_error")}</span>
            <Button
              stretch="auto"
              size="md"
              variant="secondary"
              label={t("common.retry")}
              onClick={() => void mutate(`template:${workspaceSlug}:${templateId}`)}
            />
          </div>
        ) : templateId && !existing ? (
          <p aria-busy="true">{t("loading")}</p>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-6">
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
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
              <div className="flex flex-col gap-5 rounded-lg border border-subtle bg-surface-1 p-5">
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
                ) : (
                  <div className="min-h-48 rounded-md border border-subtle">
                    <RichTextEditor
                      key={templateId ?? kind}
                      editable
                      id="workspace-template-editor"
                      initialValue={draft.description_html}
                      workspaceSlug={workspaceSlug}
                      workspaceId={getWorkspaceBySlug(workspaceSlug)?.id ?? ""}
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
                )}
                {kind === "work_item" && (
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
                        {multi(
                          t("assignees"),
                          (options?.assignees ?? []).map((m) => ({ id: m.member_id, name: m.member__display_name })),
                          "assignee_ids"
                        )}
                        {multi(t("labels"), options?.labels ?? [], "label_ids")}
                        {multi(t("modules"), options?.modules ?? [], "module_ids")}
                      </div>
                    )}
                    {children("children")}
                  </>
                )}
                {kind === "project" && (
                  <>
                    <details className="rounded-lg border border-subtle p-4">
                      <summary className="cursor-pointer text-13 font-medium">{t("web.template_features")}</summary>
                      <div className="mt-4 flex flex-col gap-4">
                        {(["cycle_view", "module_view", "page_view", "issue_views_view", "intake_view"] as const).map(
                          (field) => (
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
                          )
                        )}
                      </div>
                    </details>
                    {(["states", "labels"] as const).map((key) => (
                      <details key={key} className="rounded-lg border border-subtle p-4">
                        <summary className="cursor-pointer text-13 font-medium">
                          {t(key === "states" ? "web.template_states" : "labels")}
                        </summary>
                        <div className="mt-4 flex flex-col gap-3">
                          {(config[key] ?? []).map((entry, index) => (
                            <div key={entry.client_id} className="flex flex-wrap items-center gap-2">
                              <CategoryColorPicker
                                kind={key === "states" ? "status" : "label"}
                                value={entry.color}
                                onChange={(color) =>
                                  configure({
                                    [key]: (config[key] ?? []).map((item, i) =>
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
                                      [key]: (config[key] ?? []).map((item, i) =>
                                        i === index ? Object.assign({}, item, { name: e.target.value }) : item
                                      ),
                                    })
                                  }
                                />
                              </div>
                              {key === "states" && (
                                <div className="w-36">
                                  <ConfigurationSelect
                                    value={config.states?.[index].group ?? "unstarted"}
                                    placeholder={t("state")}
                                    options={["backlog", "unstarted", "started", "completed", "cancelled"].map(
                                      (value) => ({ value, label: t(`web.template_state_${value}`) })
                                    )}
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
                              <Button
                                stretch="auto"
                                size="sm"
                                variant="ghost"
                                label={t("delete")}
                                onClick={() => configure({ [key]: (config[key] ?? []).filter((_, i) => i !== index) })}
                              />
                            </div>
                          ))}
                          <Button
                            stretch="auto"
                            size="md"
                            variant="secondary"
                            label={t(key === "states" ? "web.add_project_status" : "web.add_project_label")}
                            onClick={() =>
                              configure({
                                [key]: [
                                  ...(config[key] ?? []),
                                  ...(key === "states"
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
                    ))}
                    {children("work_items")}
                  </>
                )}
              </div>
            </fieldset>
            {(message || optionsError) && (
              <p role="alert" className="text-13 text-danger-primary">
                {message || t("web.configuration_load_error")}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button stretch="auto" size="md" variant="secondary" label={t("cancel")} disabled={busy} onClick={back} />
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
          </form>
        )}
      </div>
    </SettingsContentWrapper>
  );
}
