import { CalendarDays, CircleDashed, FolderKanban, Hash, Layers, Tag, UserRound } from "lucide-react";
import { PriorityIcon } from "@plane/blocks/icons";
import type { ChartXAxisProperty } from "@plane/types";
import { AnalyticsEntityCell } from "./entity-cell";

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
  const validId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  const user = axis === "ASSIGNEES" || axis === "CREATED_BY";
  const href = !validId
    ? undefined
    : user
      ? `/${slug}/profile/${id}/`
      : axis === "PROJECTS"
        ? `/${slug}/projects/${id}/issues/`
        : projectId && (axis === "CYCLES" || axis === "MODULES")
          ? `/${slug}/projects/${projectId}/${axis.toLowerCase()}/${id}/`
          : undefined;
  const Icon = user
    ? UserRound
    : axis === "PROJECTS"
      ? FolderKanban
      : axis === "MODULES"
        ? Layers
        : axis === "CYCLES" || axis === "STATES" || axis === "STATE_GROUPS"
          ? CircleDashed
          : axis === "LABELS"
            ? Tag
            : axis?.endsWith("DATE") || axis?.endsWith("AT")
              ? CalendarDays
              : Hash;
  return (
    <AnalyticsEntityCell
      name={name}
      href={href}
      icon={
        axis === "PRIORITY" ? (
          <PriorityIcon
            priority={id === "urgent" || id === "high" || id === "medium" || id === "low" ? id : "none"}
            className="size-4"
          />
        ) : (
          <Icon className="size-4 text-tertiary" />
        )
      }
    />
  );
}
