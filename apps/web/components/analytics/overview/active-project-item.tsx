/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { Link } from "react-router";
import { FolderKanban } from "lucide-react";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
import { useProject } from "@/hooks/store/use-project";

type Props = { project: { id: string; completed_issues?: number; total_issues?: number } };
export default function ActiveProjectItem({ project }: Props) {
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const { t } = useTranslation();
  const details = getProjectById(project.id);
  if (!details) return null;
  const total = project.total_issues ?? 0,
    done = project.completed_issues ?? 0;
  const percentage = total ? Math.round((done / total) * 100) : 0;
  return (
    <Tooltip
      label={`${details.name} · ${t("workspace_analytics.dashboard.project_progress_hint", { completed: done, total, percentage })}`}
    >
      <Link
        to={`/${workspaceSlug}/projects/${project.id}/issues/`}
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-layer-transparent-hover"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-layer-1">
          {details.logo_props ? (
            <Logo logo={details.logo_props} size={16} />
          ) : (
            <FolderKanban className="size-4 text-tertiary" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-13 font-medium text-primary">{details.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {total > 0 && (
              <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${percentage}%`, backgroundColor: "light-dark(#48897d, #80b8a8)" }}
                />
              </span>
            )}
            <span className="shrink-0 text-11 text-tertiary tabular-nums">
              {total ? `${done} / ${total}` : t("workspace_analytics.dashboard.empty_project")}
            </span>
          </div>
        </div>
        {total > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-sm px-1.5 py-0.5 text-11 tabular-nums",
              percentage > 50 ? "bg-success-subtle text-success-primary" : "bg-layer-2 text-secondary"
            )}
          >
            {percentage}%
          </span>
        )}
      </Link>
    </Tooltip>
  );
}
