import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IProject } from "@plane/types";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { BaseGanttLayout } from "@/components/base-layouts/gantt/layout";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
import { renderFormattedDate } from "@plane/utils";
import { ProjectStatusIcon } from "./project-status-icon";

type TimelineItem = { id: string; project: IProject; start_date?: string | null; target_date?: string | null };

export const ProjectTimeline = observer(function ProjectTimeline({ projects }: { projects: IProject[] }) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { statuses } = useProjectCategories(String(workspaceSlug));
  const title = t("workspace_projects.label", { count: 2 });
  const items = Object.fromEntries(
    projects.map((project) => [
      project.id,
      { id: project.id, project, start_date: project.start_date, target_date: project.target_date },
    ])
  );
  const href = (project: IProject) => `/${workspaceSlug}/projects/${project.id}/issues/`;
  const renderSidebar = ({ project }: TimelineItem) => (
    <Link href={href(project)} className="flex h-full items-center gap-2" draggable={false}>
      <span className="font-normal mr-3 w-18 shrink-0 text-11 text-tertiary">{project.identifier}</span>
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Logo logo={project.logo_props} size={16} />
      </span>
      <span className="min-w-0 truncate text-13 font-medium">{project.name}</span>
    </Link>
  );
  const renderBlock = ({ project }: TimelineItem) => {
    const status =
      statuses.find((entry) => entry.id === project.status) ??
      (!project.status ? statuses.find((entry) => entry.is_default) : undefined);
    const dates = [project.start_date, project.target_date]
      .map((date) => (date ? renderFormattedDate(date) : ""))
      .filter(Boolean)
      .join(" – ");
    return (
      <Tooltip label={`${project.name}${dates ? ` · ${dates}` : ""}`}>
        <Link
          href={href(project)}
          draggable={false}
          className="flex h-full w-full items-center gap-1.5 overflow-hidden rounded-md bg-accent-subtle px-2 text-13 text-primary"
          style={
            status?.color
              ? { backgroundColor: `color-mix(in srgb, ${status.color} 15%, var(--bg-layer-2))` }
              : undefined
          }
        >
          <ProjectStatusIcon group={status?.group ?? "draft"} color={status?.color} />
          <span className="truncate">{project.name}</span>
        </Link>
      </Tooltip>
    );
  };
  return (
    <BaseGanttLayout<TimelineItem>
      timelineType={GANTT_TIMELINE_TYPE.PROJECT}
      items={items}
      groups={[{ id: "projects", name: title }]}
      groupedItemIds={{ projects: projects.map((project) => project.id) }}
      renderSidebar={renderSidebar}
      renderBlock={renderBlock}
      title={title}
      loaderTitle={title}
      showAllBlocks
      showToday={false}
    />
  );
});
