import useSWR from "swr";
import { useUser } from "@/hooks/store/user";
import { WorkspaceService } from "@/services/workspace.service";

const workspaceService = new WorkspaceService();

export function useWorkspaceInvitations() {
  const { data: user } = useUser();
  return useSWR(
    user ? ["USER_WORKSPACE_INVITATIONS", user.id] : null,
    () => workspaceService.userWorkspaceInvitations(),
    { refreshInterval: 300_000, revalidateIfStale: false, revalidateOnFocus: false }
  );
}
