/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import useSWR from "swr";
// services
import { USER_PROFILE_ACTIVITY } from "@plane/constants";
import { UserService } from "@/services/user.service";
// components
import { ActivityList } from "./activity-list";

// services
const userService = new UserService();

type Props = {
  cursor: string;
  perPage: number;
};

export function WorkspaceActivityListPage(props: Props) {
  const { cursor, perPage } = props;
  // router
  const { workspaceSlug, userId } = useParams();

  // The page's own request drives the paging affordance; this entry shares its SWR cache.
  const { data: userProfileActivity } = useSWR(
    workspaceSlug && userId
      ? USER_PROFILE_ACTIVITY(workspaceSlug.toString(), userId.toString(), {
          cursor,
        })
      : null,
    workspaceSlug && userId
      ? () =>
          userService.getUserProfileActivity(workspaceSlug.toString(), userId.toString(), {
            cursor,
            per_page: perPage,
          })
      : null
  );

  return <ActivityList activity={userProfileActivity} />;
}
