import { CalendarDays, CircleDashed, FolderKanban, Hash, Layers, Tag, UserRound } from "lucide-react";
import { PriorityIcon } from "@plane/blocks/icons";
import { ChartXAxisProperty } from "@plane/types";
import { AnalyticsEntityCell } from "./entity-cell";

const ENTITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

const PRIORITY_IDS = ["urgent", "high", "medium", "low"] as const;

type TPriorityId = (typeof PRIORITY_IDS)[number];

const isUserAxis = (axis?: ChartXAxisProperty) =>
  axis === ChartXAxisProperty.ASSIGNEES || axis === ChartXAxisProperty.CREATED_BY;

const isCycleOrModuleAxis = (
  axis?: ChartXAxisProperty
): axis is ChartXAxisProperty.CYCLES | ChartXAxisProperty.MODULES =>
  axis === ChartXAxisProperty.CYCLES || axis === ChartXAxisProperty.MODULES;

const renderEntityIcon = (axis?: ChartXAxisProperty) => {
  const className = "size-4 text-tertiary";
  switch (axis) {
    case ChartXAxisProperty.ASSIGNEES:
    case ChartXAxisProperty.CREATED_BY:
      return <UserRound className={className} />;
    case ChartXAxisProperty.PROJECTS:
      return <FolderKanban className={className} />;
    case ChartXAxisProperty.MODULES:
      return <Layers className={className} />;
    case ChartXAxisProperty.CYCLES:
    case ChartXAxisProperty.STATES:
    case ChartXAxisProperty.STATE_GROUPS:
      return <CircleDashed className={className} />;
    case ChartXAxisProperty.LABELS:
      return <Tag className={className} />;
    default:
      return axis?.endsWith("DATE") || axis?.endsWith("AT") ? (
        <CalendarDays className={className} />
      ) : (
        <Hash className={className} />
      );
  }
};

const getEntityHref = (
  axis: ChartXAxisProperty | undefined,
  id: string,
  slug: string,
  projectId: string | undefined
) => {
  if (!ENTITY_ID_PATTERN.test(id)) return undefined;
  if (isUserAxis(axis)) return `/${slug}/profile/${id}/`;
  if (axis === ChartXAxisProperty.PROJECTS) return `/${slug}/projects/${id}/issues/`;
  if (projectId && isCycleOrModuleAxis(axis)) return `/${slug}/projects/${projectId}/${axis.toLowerCase()}/${id}/`;
  return undefined;
};

const isPriorityId = (id: string): id is TPriorityId => (PRIORITY_IDS as readonly string[]).includes(id);

export function InsightEntity({
  axis,
  id,
  name,
  slug,
  projectId,
}: {
  axis?: ChartXAxisProperty;
  id: string;
  name: string;
  slug: string;
  projectId?: string;
}) {
  return (
    <AnalyticsEntityCell
      name={name}
      href={getEntityHref(axis, id, slug, projectId)}
      icon={
        axis === ChartXAxisProperty.PRIORITY ? (
          <PriorityIcon priority={isPriorityId(id) ? id : "none"} className="size-4" />
        ) : (
          renderEntityIcon(axis)
        )
      }
    />
  );
}
