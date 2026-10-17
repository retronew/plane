import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { ChevronRightOutline, TemplatesOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { useUserPermissions } from "@/hooks/store/user";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { SettingsHeading } from "@/components/settings/heading";
import {
  configurationKey,
  projectConfigurationKey,
  workspaceConfigurationService as service,
} from "@/services/workspace-configuration.service";
import type {
  WorkspaceTemplate,
  TemplateConfiguration,
  TemplateWorkItemChild,
} from "@/services/workspace-configuration.service";
import { TemplateChildren } from "./children";
import { TemplatePageFields } from "./page-fields";
import { TemplateWorkItemFields } from "./work-item-fields";

type ProjectTemplateKind = "work_item" | "page";
type Draft = Omit<WorkspaceTemplate, "id"> & { id?: string };

export function newProjectTemplate(kind: ProjectTemplateKind, projectId: string): Draft {
  return {
    kind,
    project: projectId,
    name: "",
    short_description: "",
    title: "",
    description_html: "<p></p>",
    priority: "none",
    configuration: {},
  };
}

export function ProjectTemplateEditor() {
  const { workspaceSlug = "", projectId = "", templateKind = "", templateId } = useParams();
  const kind = templateKind === "work-item" ? "work_item" : templateKind;
  const validKind = kind === "work_item" || kind === "page";
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const allowed = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);
  const { mutate } = useSWRConfig();
  const detailKey = projectConfigurationKey(workspaceSlug, projectId, `templates:${templateId}`);
  const { data: existing, error } = useSWR(allowed && validKind && templateId ? detailKey : null, () =>
    service.projectTemplate(workspaceSlug, projectId, templateId!)
  );
  const heading = t(`web.${templateId ? "edit" : "new"}_template_${kind === "work_item" ? "work_item" : "page"}`);
  if (!allowed) return <NotAuthorizedView section="settings" className="h-auto" />;
  return (
    <SettingsContentWrapper
      compact
      header={
        <SettingsPageHeader
          leftItem={
            <nav aria-label={t("web.templates")} className="flex items-center gap-2 text-13">
              <Link
                to={`/${workspaceSlug}/settings/projects/${projectId}/templates/`}
                className="flex items-center gap-2"
              >
                <TemplatesOutline className="size-4" />
                {t("web.templates")}
              </Link>
              <ChevronRightOutline className="size-3 text-tertiary" />
              <span>{heading}</span>
            </nav>
          }
        />
      }
    >
      <div className="space-y-6">
        <div className="border-b border-subtle pb-6">
          <SettingsHeading title={heading} />
        </div>
        {!validKind || error || (existing && existing.kind !== kind) ? (
          <div role="alert" className="flex items-center gap-3 text-13">
            {t("web.configuration_load_error")}
            {validKind && (
              <Button
                size="md"
                variant="secondary"
                stretch="auto"
                label={t("common.retry")}
                onClick={() => void mutate(detailKey)}
              />
            )}
          </div>
        ) : templateId && !existing ? (
          <p aria-busy="true">{t("loading")}</p>
        ) : (
          <ProjectTemplateForm
            key={templateId ?? kind}
            initial={existing ?? newProjectTemplate(kind, projectId)}
            kind={kind}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            detailKey={detailKey}
          />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

export function ProjectTemplateForm({
  initial,
  kind,
  workspaceSlug,
  projectId,
  detailKey,
}: {
  initial: Draft;
  kind: ProjectTemplateKind;
  workspaceSlug: string;
  projectId: string;
  detailKey: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial,
    configuration: {
      ...initial.configuration,
      children: initial.configuration.children?.map((child) => ({ ...child, client_id: crypto.randomUUID() })),
    },
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (patch: Partial<Draft>) => setDraft((value) => ({ ...value, ...patch }));
  const configure = (patch: Partial<TemplateConfiguration>) =>
    setDraft((value) => ({ ...value, configuration: { ...value.configuration, ...patch } }));
  const back = () => navigate(`/${workspaceSlug}/settings/projects/${projectId}/templates/`);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !draft.name.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await service.saveProjectTemplate(workspaceSlug, projectId, {
        ...draft,
        name: draft.name.trim(),
        project: projectId,
        kind,
      });
      await mutate(detailKey, saved, { revalidate: false });
      await Promise.all([
        mutate(projectConfigurationKey(workspaceSlug, projectId)),
        mutate(configurationKey(workspaceSlug, "templates")),
      ]);
      back();
    } catch {
      setMessage(t("web.configuration_save_error"));
    } finally {
      setBusy(false);
    }
  };
  const workItem: TemplateWorkItemChild = {
    ...draft.configuration,
    name: draft.title,
    description_html: draft.description_html,
    priority: draft.priority,
  };
  const updateWorkItem = (patch: Partial<TemplateWorkItemChild>) => {
    const { name, description_html, priority, ...configuration } = patch;
    setDraft((value) => ({
      ...value,
      ...(name === undefined ? {} : { title: name }),
      ...(description_html === undefined ? {} : { description_html }),
      ...(priority === undefined ? {} : { priority }),
      configuration: { ...value.configuration, ...configuration },
    }));
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-8">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-8">
        {kind === "work_item" ? (
          <div className="space-y-4 border-b border-subtle pb-8">
            <input
              name="template.name"
              aria-label={t("web.template_name")}
              className="w-full rounded-sm bg-transparent py-1 text-16 font-medium outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-accent-strong"
              placeholder={t("web.project_template_work_item_name_placeholder")}
              required
              maxLength={100}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            <textarea
              name="template.short_description"
              aria-label={t("description")}
              className="min-h-12 w-full resize-y rounded-sm bg-transparent py-1 text-14 outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-accent-strong"
              placeholder={t("web.template_summary_hint")}
              maxLength={1000}
              value={draft.short_description}
              onChange={(event) => update({ short_description: event.target.value })}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <InputField
              orientation="vertical"
              size="md"
              name="template.name"
              label={t("web.template_name")}
              placeholder={t("web.project_template_page_name_placeholder")}
              required
              maxLength={100}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            <label className="flex flex-col gap-2 text-13">
              {t("description")}
              <textarea
                name="template.short_description"
                className="min-h-20 w-full resize-y rounded-md border border-subtle bg-layer-2 px-3 py-2 outline-none placeholder:text-placeholder focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
                maxLength={1000}
                value={draft.short_description}
                onChange={(event) => update({ short_description: event.target.value })}
              />
              <span className="text-12 text-tertiary">{t("web.template_summary_hint")}</span>
            </label>
          </div>
        )}
        {kind === "work_item" ? (
          <>
            <TemplateWorkItemFields
              value={workItem}
              onChange={updateWorkItem}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              id="template-work-item"
              disabled={busy}
            />
            <TemplateChildren
              items={draft.configuration.children ?? []}
              onChange={(children) => configure({ children })}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              disabled={busy}
            />
          </>
        ) : (
          <TemplatePageFields
            title={draft.title}
            description={draft.description_html}
            logo={draft.configuration.logo_props}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            disabled={busy}
            onChange={({ logo_props, ...patch }) => {
              setDraft((value) => ({
                ...value,
                ...patch,
                configuration: { ...value.configuration, ...(logo_props ? { logo_props } : {}) },
              }));
            }}
          />
        )}
      </fieldset>
      {message && (
        <p role="alert" className="text-13 text-danger-primary">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-subtle pt-8">
        <Button stretch="auto" size="md" variant="secondary" label={t("cancel")} onClick={back} disabled={busy} />
        <Button
          stretch="auto"
          size="md"
          variant="primary"
          type="submit"
          label={t(draft.id ? "save" : `web.create_template_${kind}`)}
          loading={busy}
          disabled={busy || !draft.name.trim()}
        />
      </div>
    </form>
  );
}
