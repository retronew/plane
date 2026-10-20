import { PROFILE_SETTINGS_TABS } from "@plane/constants";
import type { TProfileSettingsTabs } from "@plane/types";

export const PROFILE_SETTINGS_QUERY_KEY = "profileSettings";

export const getProfileSettingsTab = (tab: string | null | undefined): TProfileSettingsTabs =>
  PROFILE_SETTINGS_TABS.includes(tab as TProfileSettingsTabs) ? (tab as TProfileSettingsTabs) : "general";

export function getProfileSettingsRedirect(
  tab: string | undefined,
  search: string,
  hash: string,
  workspaceSlugs: string[],
  preferredSlug?: string
): string {
  const slug = workspaceSlugs.includes(preferredSlug ?? "") ? preferredSlug : workspaceSlugs[0];
  const params = new URLSearchParams(search);
  params.set(PROFILE_SETTINGS_QUERY_KEY, getProfileSettingsTab(tab));
  return `${slug ? `/${slug}` : "/create-workspace"}?${params.toString()}${hash}`;
}
