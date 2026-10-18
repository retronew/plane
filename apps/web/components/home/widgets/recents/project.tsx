/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
// plane types
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
import type { TActivityEntityData, TProjectEntityData } from "@plane/types";
import { calculateTimeAgo, getDateTimeFormatter } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
// helpers

type BlockProps = {
  activity: TActivityEntityData;
  ref: React.RefObject<HTMLDivElement | null>;
  workspaceSlug: string;
};
export function RecentProject(props: BlockProps) {
  const { activity, ref, workspaceSlug } = props;
  // router
  const router = useRouter();
  // derived values
  const projectDetails: TProjectEntityData = activity.entity_data as TProjectEntityData;

  if (!projectDetails) return <></>;

  const projectLink = `/${workspaceSlug}/projects/${projectDetails?.id}/issues`;

  return (
    <ListItem
      compact
      key={activity.id}
      itemLink={projectLink}
      title={projectDetails?.name}
      prependTitleTooltip={`${projectDetails.identifier} · ${projectDetails.name}`}
      prependTitleElement={
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className="grid size-5 flex-shrink-0 place-items-center rounded-[4px] bg-layer-2">
            <ProjectLogo logo={projectDetails?.logo_props} size={16} background />
          </div>
          <div className="text-caption-md-regular whitespace-nowrap text-tertiary">{projectDetails?.identifier}</div>
        </div>
      }
      appendTitleTooltip={getDateTimeFormatter({ dateStyle: "full", timeStyle: "medium" }).format(
        new Date(activity.visited_at)
      )}
      appendTitleElement={
        <div className="flex-shrink-0 text-caption-md-regular text-tertiary">
          {calculateTimeAgo(activity.visited_at)}
        </div>
      }
      quickActionElement={
        <div className="flex shrink-0 items-center gap-2">
          {projectDetails?.project_members?.length > 0 && (
            <div className="h-5">
              <MemberSelect
                projectId={projectDetails?.id}
                value={projectDetails?.project_members}
                onChange={() => {}}
                disabled
                multiple
                variant="avatar-group-sm"
                tooltip
              />
            </div>
          )}
        </div>
      }
      parentRef={ref}
      disableLink={false}
      className="border-none"
      onItemClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(projectLink);
      }}
    />
  );
}
