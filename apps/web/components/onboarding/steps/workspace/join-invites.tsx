/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import { Checkbox } from "@makeplane/propel/components/checkbox";
// plane imports
import { ROLE } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import type { IWorkspaceMemberInvitation } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
import { truncateText } from "@plane/utils";
// constants
import { WorkspaceLogo } from "@/components/workspace/logo";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserSettings } from "@/hooks/store/user";
// services
import { WorkspaceService } from "@/services/workspace.service";
// local components
import { CommonOnboardingHeader } from "../common";
import { translate } from "@plane/i18n";

type Props = {
  invitations: IWorkspaceMemberInvitation[];
  handleNextStep: () => Promise<void>;
  handleCurrentViewChange: () => void;
};
const workspaceService = new WorkspaceService();

export function WorkspaceJoinInvitesStep(props: Props) {
  const { invitations, handleNextStep, handleCurrentViewChange } = props;
  // states
  const checkboxId = useId();
  const [isJoiningWorkspaces, setIsJoiningWorkspaces] = useState(false);
  const [invitationsRespond, setInvitationsRespond] = useState<string[]>([]);
  const invitationsRespondSet = new Set(invitationsRespond);
  // store hooks
  const { fetchWorkspaces } = useWorkspace();
  const { fetchCurrentUserSettings } = useUserSettings();

  // handle invitation
  const handleInvitation = (workspace_invitation: IWorkspaceMemberInvitation, action: "accepted" | "withdraw") => {
    if (action === "accepted") {
      setInvitationsRespond((prevData) =>
        prevData.includes(workspace_invitation.id) ? prevData : [...prevData, workspace_invitation.id]
      );
    } else if (action === "withdraw") {
      setInvitationsRespond((prevData) => prevData.filter((item: string) => item !== workspace_invitation.id));
    }
  };

  // submit invitations
  const submitInvitations = async () => {
    const invitation = invitations?.find((item) => item.id === invitationsRespond[0]);

    if (invitationsRespond.length <= 0 && !invitation?.role) return;

    setIsJoiningWorkspaces(true);

    try {
      await workspaceService.joinWorkspaces({ invitations: invitationsRespond });
      await fetchWorkspaces();
      await fetchCurrentUserSettings();
      await handleNextStep();
    } catch (error: any) {
      console.error(error);
      setIsJoiningWorkspaces(false);
    }
  };

  return invitations && invitations.length > 0 ? (
    <div className="flex flex-col gap-10">
      <CommonOnboardingHeader
        title={translate("web.join_invites_or_create_a_workspace")}
        description={translate("web.all_your_work_unified")}
      />
      <div className="flex flex-col gap-3">
        {invitations &&
          invitations.length > 0 &&
          invitations.map((invitation) => {
            const isSelected = invitationsRespondSet.has(invitation.id);
            const invitedWorkspace = invitation.workspace;
            return (
              <label
                key={invitation.id}
                htmlFor={`${checkboxId}-${invitation.id}`}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border border-subtle px-3 py-2 hover:bg-surface-2`}
              >
                <div className="flex-shrink-0">
                  <WorkspaceLogo
                    logo={invitedWorkspace?.logo_url}
                    name={invitedWorkspace?.name}
                    classNames="size-8 flex-shrink-0 rounded-lg"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-13 font-medium">{truncateText(invitedWorkspace?.name, 30)}</div>
                  <p className="text-11 text-secondary">{ROLE[invitation.role]}</p>
                </div>
                <span className="flex-shrink-0">
                  <Checkbox
                    id={`${checkboxId}-${invitation.id}`}
                    checked={isSelected}
                    disabled={isJoiningWorkspaces}
                    onCheckedChange={(checked) => handleInvitation(invitation, checked ? "accepted" : "withdraw")}
                    aria-label={invitedWorkspace?.name ?? translate("web.select_workspace_invitation")}
                  />
                </span>
              </label>
            );
          })}
      </div>
      <div className="flex flex-col gap-4">
        <ButtonElement
          variant="primary"
          size="lg"
          stretch="full"
          onClick={submitInvitations}
          disabled={isJoiningWorkspaces || !invitationsRespond.length}
        >
          {isJoiningWorkspaces ? <Spinner height="20px" width="20px" /> : translate("web.continue")}
        </ButtonElement>
        <Button
          variant="ghost"
          size="lg"
          stretch="full"
          label={translate("web.create_new_workspace")}
          onClick={handleCurrentViewChange}
          disabled={isJoiningWorkspaces}
        />
      </div>
    </div>
  ) : (
    <div>{translate("web.no_invitations_found")}</div>
  );
}
