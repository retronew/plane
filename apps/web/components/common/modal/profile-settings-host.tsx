import { lazy, Suspense, useEffect, useRef } from "react";
import type { TProfileSettingsTabs } from "@plane/types";
import { observer } from "mobx-react";
import { useLocation, useNavigate } from "react-router";
import { getProfileSettingsTab, PROFILE_SETTINGS_QUERY_KEY } from "@/helpers/profile-settings";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUser } from "@/hooks/store/user";

const ProfileSettingsModal = lazy(() =>
  import("@/components/settings/profile/modal").then((module) => ({ default: module.ProfileSettingsModal }))
);

export const ProfileSettingsHost = observer(function ProfileSettingsHost() {
  const { data: user } = useUser();
  const { toggleProfileSettingsModal } = useCommandPalette();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const pendingTab = useRef<TProfileSettingsTabs | null>(null);

  useEffect(() => {
    // The legacy route must reach its background page before opening the modal.
    if (!user || pathname.startsWith("/settings/profile")) return;
    const params = new URLSearchParams(search);
    if (!params.has(PROFILE_SETTINGS_QUERY_KEY)) {
      if (pendingTab.current) {
        toggleProfileSettingsModal({ activeTab: pendingTab.current, isOpen: true });
        pendingTab.current = null;
      }
      return;
    }
    pendingTab.current = getProfileSettingsTab(params.get(PROFILE_SETTINGS_QUERY_KEY));
    params.delete(PROFILE_SETTINGS_QUERY_KEY);
    const query = params.toString();
    void navigate(`${pathname}${query ? `?${query}` : ""}${hash}`, { replace: true });
  }, [user, pathname, search, hash, navigate, toggleProfileSettingsModal]);

  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <ProfileSettingsModal />
    </Suspense>
  );
});
