import { useEffect } from "react";
import { observer } from "mobx-react";
import { useLocation, useNavigate, useParams } from "react-router";
import useSWR from "swr";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { getProfileSettingsRedirect } from "@/helpers/profile-settings";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserSettings } from "@/hooks/store/user";

function ProfileSettingsPage() {
  const { profileTabId } = useParams();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const { fetchWorkspaces } = useWorkspace();
  const { data: settings } = useUserSettings();
  const { data: workspaces, error } = useSWR("PROFILE_SETTINGS_WORKSPACES", () => fetchWorkspaces(), {
    revalidateOnFocus: false,
  });
  const preferredSlug = settings?.workspace?.last_workspace_slug || settings?.workspace?.fallback_workspace_slug;

  useEffect(() => {
    if (!workspaces && !error) return;
    void navigate(
      getProfileSettingsRedirect(
        profileTabId,
        search,
        hash,
        (workspaces ?? []).map((workspace) => workspace.slug),
        preferredSlug
      ),
      { replace: true }
    );
  }, [workspaces, error, profileTabId, search, hash, preferredSlug, navigate]);

  return (
    <div className="grid size-full place-items-center">
      <LogoSpinner />
    </div>
  );
}

export default observer(ProfileSettingsPage);
