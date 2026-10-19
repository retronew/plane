import { observer } from "mobx-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { useParams } from "next/navigation";
import { CalendarOutline } from "@makeplane/propel/icons";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
import { DateRangeSelect, LabelSelect } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { cn, formatCompactDateRange, formatLocalizedDate, getDate, renderFormattedPayloadDate } from "@plane/utils";
import { setToast } from "@plane/blocks/toast";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { useProject } from "@/hooks/store/use-project";
import { useUserProfile } from "@/hooks/store/user";

type Translate = ReturnType<typeof useTranslation>["t"];
type SaveChanges = (changes: Partial<IProject>) => void;
type LabelEntry = { id: string; name: string };

function getProjectLeadId(project: IProject) {
  return typeof project.project_lead === "object" ? project.project_lead?.id : project.project_lead;
}

function getSelectedLabels(labelIds: string[] | undefined, labels: LabelEntry[]) {
  return (labelIds ?? []).flatMap((id) => {
    const entry = labels.find((label) => label.id === id);
    return entry ? [entry] : [];
  });
}

function getDateRangeTooltip(from: Date | null, to: Date | null) {
  return [from, to]
    .filter((date): date is Date => !!date)
    .map((date) => formatLocalizedDate(date, "MMM dd, yyyy"))
    .join(" – ");
}

function canSaveProject(disabled: boolean, busy: boolean, workspaceSlug: string | undefined) {
  return !disabled && !busy && Boolean(workspaceSlug);
}

function PriorityProperty({
  project,
  disabled,
  busy,
  onSave,
}: {
  project: IProject;
  disabled: boolean;
  busy: boolean;
  onSave: SaveChanges;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <PrioritySelect
        value={project.priority ?? "none"}
        onChange={(priority) => onSave({ priority: priority ?? "none" })}
        disabled={disabled || busy}
        variant="pill-md"
        tooltip
      />
    </div>
  );
}

function LeadProperty({
  project,
  disabled,
  busy,
  wrap,
  onSave,
  t,
}: {
  project: IProject;
  disabled: boolean;
  busy: boolean;
  wrap: boolean;
  onSave: SaveChanges;
  t: Translate;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <MemberSelect
        value={getProjectLeadId(project)}
        multiple={false}
        clearable
        showLabel={wrap}
        placeholder={wrap ? t("lead") : ""}
        variant="pill-md"
        disabled={disabled || busy}
        onChange={(id) => onSave({ project_lead: id || null })}
        tooltip={{ heading: t("lead") }}
      />
    </div>
  );
}

function LabelsProperty({
  project,
  labels,
  disabled,
  busy,
  wrap,
  stretch,
  onSave,
  t,
}: {
  project: IProject;
  labels: LabelEntry[];
  disabled: boolean;
  busy: boolean;
  wrap: boolean;
  stretch: boolean;
  onSave: SaveChanges;
  t: Translate;
}) {
  const selectedLabels = getSelectedLabels(project.labels, labels);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        wrap ? "max-w-full" : selectedLabels.length && stretch ? "flex-1" : "shrink-0"
      )}
    >
      <LabelSelect
        getValues={async ({ search }) => ({
          results: labels.filter((label) =>
            label.name.toLocaleLowerCase().includes(search?.trim().toLocaleLowerCase() ?? "")
          ),
          next_page_results: false,
        })}
        value={selectedLabels}
        onChange={(ids) => onSave({ labels: ids })}
        variant="pill-md"
        disabled={disabled || busy}
        placeholder={wrap ? t("labels") : ""}
        className={wrap || !stretch ? undefined : "w-full max-w-full"}
        tooltip={{ heading: t("labels") }}
      />
    </div>
  );
}

function DateProperty({
  project,
  disabled,
  busy,
  wrap,
  stretch,
  weekStartsOn,
  onSave,
  t,
}: {
  project: IProject;
  disabled: boolean;
  busy: boolean;
  wrap: boolean;
  stretch: boolean;
  weekStartsOn: ComponentProps<typeof DateRangeSelect>["weekStartsOn"];
  onSave: SaveChanges;
  t: Translate;
}) {
  const from = getDate(project.start_date) ?? null;
  const to = getDate(project.target_date) ?? null;

  return (
    <div className={cn("flex min-w-0 items-center", wrap || !stretch ? "max-w-full" : "flex-[1.5]")}>
      <DateRangeSelect
        value={{ from, to }}
        onChange={(range) =>
          onSave({
            start_date: range.from ? renderFormattedPayloadDate(range.from) : null,
            target_date: range.to ? renderFormattedPayloadDate(range.to) : null,
          })
        }
        disabled={disabled || busy}
        variant="pill-md"
        clearable
        mergeDates
        formatLabel={wrap ? undefined : formatCompactDateRange}
        showTooltip
        tooltipHeading={t("web.runtime.date_range_placeholder")}
        placeholder={wrap ? t("web.runtime.date_range_placeholder") : t("date")}
        tooltipContent={getDateRangeTooltip(from, to)}
        icon={<CalendarOutline />}
        weekStartsOn={weekStartsOn}
        className={wrap || !stretch ? "max-w-full" : "w-full max-w-full"}
      />
    </div>
  );
}

export const ProjectCardProperties = observer(function ProjectCardProperties({
  project,
  disabled,
  wrap = false,
  stretch = true,
}: {
  project: IProject;
  disabled: boolean;
  wrap?: boolean;
  stretch?: boolean;
}) {
  const { workspaceSlug } = useParams();
  const { updateProject } = useProject();
  const { labels } = useProjectCategories(String(workspaceSlug));
  const { data: profile } = useUserProfile();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const save = async (changes: Partial<IProject>) => {
    if (!canSaveProject(disabled, busy, workspaceSlug)) return;
    setBusy(true);
    try {
      await updateProject(String(workspaceSlug), project.id, changes);
    } catch {
      setToast({ type: "error", title: t("web.configuration_save_error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      className={wrap ? "contents" : cn("flex min-w-0 items-center gap-1", stretch && "flex-1")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <PriorityProperty project={project} disabled={disabled} busy={busy} onSave={save} />
      <LeadProperty project={project} disabled={disabled} busy={busy} wrap={wrap} onSave={save} t={t} />
      <LabelsProperty
        project={project}
        labels={labels}
        disabled={disabled}
        busy={busy}
        wrap={wrap}
        stretch={stretch}
        onSave={save}
        t={t}
      />
      <DateProperty
        project={project}
        disabled={disabled}
        busy={busy}
        wrap={wrap}
        stretch={stretch}
        weekStartsOn={profile?.start_of_the_week}
        onSave={save}
        t={t}
      />
    </div>
  );
});
