import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import type { IProject, TProjectLayout } from "@plane/types";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
import { BaseKanbanLayout } from "@/components/base-layouts/kanban/layout";
import { BaseListLayout } from "@/components/base-layouts/list/layout";
import { ProjectStatusIcon } from "./project-status-icon";
import { ProjectCard } from "./card";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
import { useMember } from "@/hooks/store/use-member";
import { PriorityIcon } from "@plane/blocks/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { getFileURL } from "@plane/utils";
import { getProjectGroupCreateDefaults, groupProjectRecords } from "./grouping";
import { ProjectTimeline } from "./timeline";
import { GroupHeader } from "@/components/base-layouts/kanban/group-header";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Plus } from "lucide-react";
import { useCanCreateProject } from "@/hooks/use-can-create-project";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUser } from "@/hooks/store/user";

export const ProjectLayouts = observer(function ProjectLayouts({
  projects,
  layout,
}: {
  projects: IProject[];
  layout: TProjectLayout;
}) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { statuses, labels = [] } = useProjectCategories(String(workspaceSlug));
  const { currentWorkspaceDisplayFilters } = useProjectFilter();
  const { getUserDetails } = useMember();
  const canCreateProject = useCanCreateProject(String(workspaceSlug));
  const { toggleCreateProjectModal } = useCommandPalette();
  const { data: currentUser } = useUser();
  const groupBy = currentWorkspaceDisplayFilters?.group_by ?? "status";
  if (layout === "gallery")
    return (
      <div
        data-project-layout="gallery"
        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  if (layout === "timeline")
    return (
      <div data-project-layout="timeline" className="h-full min-h-0">
        <ProjectTimeline projects={projects} />
      </div>
    );
  const grouped = groupProjectRecords(projects, statuses, labels, groupBy);
  const shared = {
    items: Object.fromEntries(projects.map((project) => [project.id, { id: project.id, project }])),
    groups: grouped.map((group) => {
      const member = group.creator ? getUserDetails(group.creator) : undefined;
      return {
        id: group.id,
        name:
          group.status?.name ??
          group.label?.name ??
          (group.phase
            ? t(`web.project_phase_${group.phase}`)
            : group.priority
              ? t(`web.${group.priority}`)
              : groupBy === "created_by"
                ? (member?.display_name ?? t("web.project_page.unknown_creator"))
                : t(
                    groupBy === "labels"
                      ? "web.project_page.no_labels"
                      : statuses.length
                        ? "web.no_project_status"
                        : "web.project_page.all_projects"
                  )),
        icon: group.status ? (
          <ProjectStatusIcon group={group.status.group} color={group.status.color} />
        ) : group.phase ? (
          <ProjectStatusIcon group={group.phase} />
        ) : group.priority ? (
          <PriorityIcon priority={group.priority} className="size-3.5" />
        ) : group.label?.color ? (
          <span className="size-2 rounded-full" style={{ background: group.label.color }} />
        ) : member ? (
          <Avatar
            size="xs"
            alt={member.display_name}
            fallback={member.display_name?.[0]}
            src={getFileURL(member.avatar_url)}
          />
        ) : undefined,
      };
    }),
    groupedItemIds: Object.fromEntries(grouped.map((group) => [group.id, group.projects.map((project) => project.id)])),
    showEmptyGroups: true,
    enableDragDrop: false,
    renderItem: (item: { id: string; project: IProject }) => (
      <ProjectCard
        project={item.project}
        compact={layout === "list"}
        wrapProperties={layout === "board"}
        className={layout === "board" ? "bg-layer-2 hover:bg-layer-2-hover" : undefined}
      />
    ),
  };
  return (
    <div data-project-layout={layout} className="h-full min-h-0">
      {layout === "board" ? (
        <BaseKanbanLayout
          {...shared}
          renderGroupHeader={(props) => {
            const group = grouped.find((entry) => entry.id === props.group.id)!;
            const defaults = getProjectGroupCreateDefaults(group, groupBy, statuses, currentUser?.id);
            return (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <GroupHeader {...props} />
                </div>
                {canCreateProject && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    showTooltip
                    aria-label={t(
                      defaults === null
                        ? "web.project_page.group_create_unavailable"
                        : "workspace_projects.create.label"
                    )}
                    disabled={defaults === null}
                    icon={<Plus className="size-3.5" />}
                    onClick={() => {
                      if (defaults) toggleCreateProjectModal(true, defaults);
                    }}
                  />
                )}
              </div>
            );
          }}
        />
      ) : (
        <BaseListLayout {...shared} />
      )}
    </div>
  );
});
