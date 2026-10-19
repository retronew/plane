/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { sortBy } from "lodash-es";
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { useTranslation } from "@plane/i18n";
import type { IWorkspaceMember } from "@plane/types";
// components
import { CountChip } from "@/components/common/count-chip";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
// hooks
import { useMember } from "@/hooks/store/use-member";
// local imports
import { WorkspaceInvitationsListItem } from "./invitations-list-item";
import { WorkspaceMembersListItem } from "./members-list-item";

function MembersDirectory({
  memberIds,
  invitationIds,
  memberDetails,
}: {
  memberIds?: string[] | null;
  invitationIds?: string[] | null;
  memberDetails: (IWorkspaceMember | null)[];
}) {
  const { t } = useTranslation();
  const noMatches = invitationIds?.length === 0 && memberIds?.length === 0;

  return (
    <div className="min-w-0 divide-y-[0.5px] divide-subtle">
      {memberIds?.length !== 0 && <WorkspaceMembersListItem memberDetails={memberDetails} />}
      {noMatches && (
        <h4 className="mt-16 text-center text-body-xs-regular text-placeholder">{t("no_matching_members")}</h4>
      )}
    </div>
  );
}

function PendingInvitations({
  invitationIds,
  open,
  onOpenChange,
}: {
  invitationIds?: string[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  if (!invitationIds || invitationIds.length === 0) return null;

  return (
    <div className="pt-4">
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <span className="inline-flex items-center gap-2 py-2">
            <span className="text-h5-medium">{t("workspace_settings.settings.members.pending_invites")}</span>
            {invitationIds && <CountChip count={invitationIds.length} className="h-5" />}
          </span>
        }
      >
        <div className="ml-auto items-center gap-1.5 rounded-md bg-surface-1 py-1.5">
          {invitationIds?.map((invitationId) => (
            <WorkspaceInvitationsListItem key={invitationId} invitationId={invitationId} />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

export const WorkspaceMembersList = observer(function WorkspaceMembersList(props: {
  searchQuery: string;
  isAdmin: boolean;
}) {
  const { searchQuery, isAdmin } = props;
  const [showPendingInvites, setShowPendingInvites] = useState<boolean>(true);

  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const {
    workspace: {
      fetchWorkspaceMembers,
      fetchWorkspaceMemberInvitations,
      workspaceMemberIds,
      getFilteredWorkspaceMemberIds,
      getSearchedWorkspaceMemberIds,
      workspaceMemberInvitationIds,
      getSearchedWorkspaceInvitationIds,
      getWorkspaceMemberDetails,
    },
  } = useMember();
  // fetching workspace invitations
  useSWR(
    workspaceSlug ? `WORKSPACE_MEMBERS_AND_MEMBER_INVITATIONS_${workspaceSlug.toString()}` : null,
    workspaceSlug
      ? async () => {
          await fetchWorkspaceMemberInvitations(workspaceSlug.toString());
          await fetchWorkspaceMembers(workspaceSlug.toString());
        }
      : null
  );

  if (!workspaceMemberIds && !workspaceMemberInvitationIds) return <MembersSettingsLoader />;

  // derived values
  const filteredMemberIds = workspaceSlug ? getFilteredWorkspaceMemberIds(workspaceSlug.toString()) : [];
  const searchedMemberIds = searchQuery ? getSearchedWorkspaceMemberIds(searchQuery) : filteredMemberIds;
  const searchedInvitationsIds = getSearchedWorkspaceInvitationIds(searchQuery);
  const memberDetails = sortBy(
    searchedMemberIds?.map((memberId) => getWorkspaceMemberDetails(memberId)) ?? [],
    (member) => (member?.is_active ? 0 : 1)
  );

  return (
    <>
      <MembersDirectory
        memberIds={searchedMemberIds}
        invitationIds={searchedInvitationsIds}
        memberDetails={memberDetails ?? []}
      />
      {isAdmin && (
        <PendingInvitations
          invitationIds={searchedInvitationsIds}
          open={showPendingInvites}
          onOpenChange={setShowPendingInvites}
        />
      )}
    </>
  );
});
