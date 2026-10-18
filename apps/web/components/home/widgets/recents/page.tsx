/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { PagesOutline } from "@makeplane/propel/icons";
// plane import
import type { TActivityEntityData, TPageEntityData } from "@plane/types";
import { calculateTimeAgo, getDateTimeFormatter, getFileURL, getPageName } from "@plane/utils";
import { ListItem } from "@/components/core/list";
// hooks
import { useMember } from "@/hooks/store/use-member";

type BlockProps = {
  activity: TActivityEntityData;
  ref: React.RefObject<HTMLDivElement | null>;
  workspaceSlug: string;
};

export function RecentPage(props: BlockProps) {
  const { activity, ref, workspaceSlug } = props;
  // router
  const router = useRouter();
  // store hooks
  const { getUserDetails } = useMember();
  // derived values
  const pageDetails = activity.entity_data as TPageEntityData;

  if (!pageDetails) return <></>;

  const ownerDetails = getUserDetails(pageDetails?.owned_by);
  const pageLink = pageDetails.project_id
    ? `/${workspaceSlug}/projects/${pageDetails.project_id}/pages/${pageDetails.id}`
    : `/${workspaceSlug}/pages/${pageDetails.id}`;

  return (
    <ListItem
      compact
      key={activity.id}
      itemLink={pageLink}
      title={getPageName(pageDetails?.name)}
      prependTitleTooltip={pageDetails.project_identifier || getPageName(pageDetails.name)}
      prependTitleElement={
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className="grid size-5 flex-shrink-0 place-items-center">
            {pageDetails?.logo_props?.in_use ? (
              <Logo logo={pageDetails?.logo_props} size={16} type="lucide" />
            ) : (
              <PagesOutline className="size-4 text-tertiary" />
            )}
          </div>
          {pageDetails?.project_identifier && (
            <div className="text-caption-md-regular whitespace-nowrap text-tertiary">
              {pageDetails?.project_identifier}
            </div>
          )}
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
          <Tooltip label={ownerDetails?.display_name ?? ""} disabled={!ownerDetails?.display_name}>
            <span className="flex">
              <Avatar
                alt={ownerDetails?.display_name}
                fallback={ownerDetails?.display_name?.[0]?.toUpperCase()}
                src={getFileURL(ownerDetails?.avatar_url ?? "")}
                size="xs"
              />
            </span>
          </Tooltip>
        </div>
      }
      parentRef={ref}
      disableLink={false}
      className="border-none"
      itemClassName="bg-layer-transparent"
      onItemClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(pageLink);
      }}
    />
  );
}
