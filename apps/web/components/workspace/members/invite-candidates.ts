/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TWorkspaceInviteCandidate } from "@/services/workspace.service";

export function getInviteCandidateName(user: TWorkspaceInviteCandidate): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.display_name || user.email;
}

export function filterInviteCandidates(
  users: TWorkspaceInviteCandidate[],
  search: string
): TWorkspaceInviteCandidate[] {
  const query = search.trim().toLocaleLowerCase();
  return users.filter((user) =>
    [user.first_name, user.last_name, user.display_name, user.email, getInviteCandidateName(user)].some((value) =>
      value?.toLocaleLowerCase().includes(query)
    )
  );
}
