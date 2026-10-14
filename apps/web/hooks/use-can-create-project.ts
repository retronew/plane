import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";

export function useCanCreateProject(workspaceSlug?: string) {
  const { currentWorkspace, getWorkspaceBySlug } = useWorkspace();
  const { allowPermissions } = useUserPermissions();
  const workspace = workspaceSlug ? getWorkspaceBySlug(workspaceSlug) : currentWorkspace;
  return allowPermissions(
    workspace?.allow_member_project_creation === false
      ? [EUserPermissions.ADMIN]
      : [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
}
