import { observer } from "mobx-react";
import { useState } from "react";
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
  const from = getDate(project.start_date) ?? null;
  const to = getDate(project.target_date) ?? null;
  const selectedLabels = (project.labels ?? []).flatMap((id) => {
    const entry = labels.find((label) => label.id === id);
    return entry ? [entry] : [];
  });
  const save = async (changes: Partial<IProject>) => {
    if (disabled || busy || !workspaceSlug) return;
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
      <div className="flex shrink-0 items-center">
        <PrioritySelect
          value={project.priority ?? "none"}
          onChange={(priority) => void save({ priority: priority ?? "none" })}
          disabled={disabled || busy}
          variant="pill-md"
          tooltip
        />
      </div>
      <div className="flex shrink-0 items-center">
        <MemberSelect
          value={typeof project.project_lead === "object" ? project.project_lead?.id : project.project_lead}
          multiple={false}
          clearable
          showLabel={wrap}
          placeholder={wrap ? t("lead") : ""}
          variant="pill-md"
          disabled={disabled || busy}
          onChange={(id) => void save({ project_lead: id || null })}
          tooltip={{ heading: t("lead") }}
        />
      </div>
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
          onChange={(ids) => void save({ labels: ids })}
          variant="pill-md"
          disabled={disabled || busy}
          placeholder={wrap ? t("labels") : ""}
          className={wrap || !stretch ? undefined : "w-full max-w-full"}
          tooltip={{ heading: t("labels") }}
        />
      </div>
      <div className={cn("flex min-w-0 items-center", wrap || !stretch ? "max-w-full" : "flex-[1.5]")}>
        <DateRangeSelect
          value={{ from, to }}
          onChange={(range) =>
            void save({
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
          tooltipContent={[from, to]
            .filter((date): date is Date => !!date)
            .map((date) => formatLocalizedDate(date, "MMM dd, yyyy"))
            .join(" – ")}
          icon={<CalendarOutline />}
          weekStartsOn={profile?.start_of_the_week}
          className={wrap || !stretch ? "max-w-full" : "w-full max-w-full"}
        />
      </div>
    </div>
  );
});
