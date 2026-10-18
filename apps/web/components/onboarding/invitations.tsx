/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { useId, useState } from "react";
import { Checkbox } from "@makeplane/propel/components/checkbox";
// plane imports
import { ROLE } from "@plane/constants";
// types
import { Button } from "@makeplane/propel/components/button";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import type { IWorkspaceMemberInvitation } from "@plane/types";
// ui
import { Spinner } from "@plane/blocks/spinner";
import { truncateText } from "@plane/utils";
// constants
// helpers
import { WorkspaceLogo } from "@/components/workspace/logo";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserSettings } from "@/hooks/store/user";
// services
import { WorkspaceService } from "@/services/workspace.service";
import { translate } from "@plane/i18n";

type Props = {
  invitations: IWorkspaceMemberInvitation[];
  handleNextStep: () => Promise<void>;
  handleCurrentViewChange: () => void;
};
const workspaceService = new WorkspaceService();

export function Invitations(props: Props) {
  const { invitations, handleNextStep, handleCurrentViewChange } = props;
  // states
  const checkboxId = useId();
  const [isJoiningWorkspaces, setIsJoiningWorkspaces] = useState(false);
  const [invitationsRespond, setInvitationsRespond] = useState<string[]>([]);
  // store hooks
  const { fetchWorkspaces } = useWorkspace();
  const { fetchCurrentUserSettings } = useUserSettings();

  const handleInvitation = (workspace_invitation: IWorkspaceMemberInvitation, action: "accepted" | "withdraw") => {
    if (action === "accepted") {
      setInvitationsRespond((prevData) =>
        prevData.includes(workspace_invitation.id) ? prevData : [...prevData, workspace_invitation.id]
      );
    } else if (action === "withdraw") {
      setInvitationsRespond((prevData) => prevData.filter((item: string) => item !== workspace_invitation.id));
    }
  };

  const submitInvitations = async () => {
    const invitation = invitations?.find((item) => item.id === invitationsRespond[0]);
    if (invitationsRespond.length <= 0 && !invitation?.role) return;
    setIsJoiningWorkspaces(true);
    try {
      await workspaceService.joinWorkspaces({ invitations: invitationsRespond });
      await fetchWorkspaces();
      await fetchCurrentUserSettings();
      await handleNextStep();
    } catch (error) {
      console.error(error);
      setIsJoiningWorkspaces(false);
    }
  };

  return invitations && invitations.length > 0 ? (
    <div className="space-y-4">
      <div className="mx-auto space-y-1 py-4 text-center">
        <h3 className="text-24 font-bold text-primary">{translate("web.you_are_invited")}</h3>
        <p className="font-medium text-placeholder">
          {translate("web.accept_the_invites_to_collaborate_with_your_team")}
        </p>
      </div>
      <div>
        {invitations &&
          invitations.length > 0 &&
          invitations.map((invitation) => {
            const isSelected = invitationsRespond.includes(invitation.id);
            const invitedWorkspace = invitation.workspace;
            return (
              <label
                key={invitation.id}
                htmlFor={`${checkboxId}-${invitation.id}`}
                className={`flex cursor-pointer items-center gap-2 rounded-sm border border-subtle p-3.5 hover:bg-surface-2`}
              >
                <div className="flex-shrink-0">
                  <WorkspaceLogo
                    logo={invitedWorkspace?.logo_url}
                    name={invitedWorkspace?.name}
                    classNames="size-9 flex-shrink-0"
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
      <ButtonElement
        variant="primary"
        size="lg"
        stretch="full"
        type="button"
        onClick={submitInvitations}
        disabled={isJoiningWorkspaces || !invitationsRespond.length}
      >
        {isJoiningWorkspaces ? <Spinner height="20px" width="20px" /> : translate("web.continue_to_workspace")}
      </ButtonElement>
      <div className="mx-auto mt-4 flex items-center sm:w-96">
        <hr className="w-full border-strong" />
        <p className="mx-3 flex-shrink-0 text-center text-13 text-placeholder">
          <Translation translationKey="web.ui.or" />
        </p>
        <hr className="w-full border-strong" />
      </div>
      <Button
        variant="ghost"
        size="lg"
        stretch="full"
        render={
          <button
            type="button"
            aria-label={translate("web.create_your_own_workspace")}
            className="bg-surface-2 text-14"
          />
        }
        onClick={handleCurrentViewChange}
        disabled={isJoiningWorkspaces}
        label={translate("web.create_your_own_workspace")}
      />
    </div>
  ) : (
    <div>{translate("web.no_invitations_found")}</div>
  );
}
