import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { ProjectSelect } from "@/components/dropdowns/project/project-select";
import { IssueTypeSelect } from "@/components/dropdowns/issue-type-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import { RichTextEditor } from "@/components/editor/rich-text";
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { TemplateWorkItemChild } from "@/services/workspace-configuration.service";

export function TemplateDescription({
  id,
  value,
  onChange,
  workspaceSlug,
  projectId,
  disabled = false,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  workspaceSlug: string;
  projectId: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { getWorkspaceBySlug } = useWorkspace();
  return (
    <RichTextEditor
      id={id}
      editable={!disabled}
      initialValue={value}
      workspaceSlug={workspaceSlug}
      workspaceId={getWorkspaceBySlug(workspaceSlug)?.id ?? ""}
      projectId={projectId}
      containerClassName="relative p-0"
      editorClassName="min-h-36 py-2 text-14"
      placeholder={placeholder}
      disabledExtensions={["image", "issue-embed", "slash-commands"]}
      onChange={(_json, html) => onChange(html)}
      searchMentionCallback={async () => ({})}
      uploadFile={async () => {
        throw new Error("Template attachments are not supported");
      }}
      duplicateFile={async () => {
        throw new Error("Template attachments are not supported");
      }}
    />
  );
}

export const TemplateWorkItemFields = observer(function TemplateWorkItemFields({
  value,
  onChange,
  workspaceSlug,
  projectId,
  id,
  disabled = false,
}: {
  value: TemplateWorkItemChild;
  onChange: (patch: Partial<TemplateWorkItemChild>) => void;
  workspaceSlug: string;
  projectId: string;
  id: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ProjectSelect value={projectId} onChange={() => undefined} disabled variant="pill-md" />
        <IssueTypeSelect
          projectId={projectId}
          value={value.type_id}
          onChange={(type_id) => onChange({ type_id, state_id: null })}
          disabled={disabled}
        />
      </div>
      <input
        name={`${id}.title`}
        aria-label={t("web.template_title")}
        className="w-full rounded-sm bg-transparent py-1 text-16 font-medium text-primary outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-accent-strong"
        placeholder={t("web.project_template_work_item_title_placeholder")}
        maxLength={255}
        value={value.name}
        onChange={(event) => onChange({ name: event.target.value })}
        disabled={disabled}
      />
      <TemplateDescription
        id={`${id}-description`}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        value={value.description_html}
        onChange={(description_html) => onChange({ description_html })}
        placeholder={t("web.project_template_work_item_description_placeholder")}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <StateSelect
          projectId={projectId}
          value={value.state_id}
          issueTypeId={value.type_id}
          isForWorkItemCreation
          variant="pill-md"
          onChange={(state_id) => onChange({ state_id })}
          disabled={disabled}
        />
        <PrioritySelect
          value={value.priority ?? "none"}
          onChange={(priority) => onChange({ priority })}
          variant="pill-md"
          disabled={disabled}
        />
        <MemberSelect
          projectId={projectId}
          value={value.assignee_ids ?? []}
          onChange={(assignee_ids) => onChange({ assignee_ids })}
          multiple
          variant={value.assignee_ids?.length ? "avatar-group-md" : "pill-md"}
          placeholder={t("assignees")}
          disabled={disabled}
        />
        <LabelSelect
          projectId={projectId}
          value={value.label_ids ?? []}
          onChange={(label_ids) => onChange({ label_ids })}
          variant="pill-md"
          placeholder={t("labels")}
          disabled={disabled}
        />
      </div>
    </div>
  );
});
