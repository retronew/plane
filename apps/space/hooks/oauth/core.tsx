/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { LockOutline } from "@makeplane/propel/icons";
import type { TOAuthConfigs, TOAuthOption } from "@plane/types";
// assets
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import githubLightLogo from "@/app/assets/logos/github-black.png?url";
import githubDarkLogo from "@/app/assets/logos/github-dark.svg?url";
import gitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import googleLogo from "@/app/assets/logos/google-logo.svg?url";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

// Falls back to the generic lock icon when no icon is configured or the image fails to load.
function OIDCProviderIcon({ iconUrl, providerName }: { iconUrl?: string; providerName: string }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

  if (!iconUrl || failedUrl === iconUrl) return <LockOutline className="size-[18px] text-secondary" />;

  return (
    <img
      src={iconUrl}
      height={18}
      width={18}
      className="size-[18px] rounded-sm object-contain"
      alt={`${providerName} Logo`}
      onError={() => setFailedUrl(iconUrl)}
    />
  );
}

export const useCoreOAuthConfig = (oauthActionText: string): TOAuthConfigs => {
  //router
  const searchParams = useSearchParams();
  // query params
  const next_path = searchParams.get("next_path");
  // theme
  const { resolvedTheme } = useTheme();
  // store hooks
  const { config } = useInstance();
  // translation
  const { t } = useTranslation();
  // derived values
  const withProvider = (provider: string) => t("web.oauth_action_with_provider", { action: oauthActionText, provider });
  const isOAuthEnabled =
    (config &&
      (config?.is_google_enabled ||
        config?.is_github_enabled ||
        config?.is_gitlab_enabled ||
        config?.is_gitea_enabled ||
        config?.is_oidc_enabled)) ||
    false;
  const oAuthOptions: TOAuthOption[] = [
    {
      id: "google",
      text: withProvider("Google"),
      icon: <img src={googleLogo} height={18} width={18} alt="Google Logo" />,
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/google/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_google_enabled,
    },
    {
      id: "github",
      text: withProvider("GitHub"),
      icon: (
        <img
          src={resolvedTheme === "dark" ? githubLightLogo : githubDarkLogo}
          height={18}
          width={18}
          alt="GitHub Logo"
        />
      ),
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/github/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_github_enabled,
    },
    {
      id: "gitlab",
      text: withProvider("GitLab"),
      icon: <img src={gitlabLogo} height={18} width={18} alt="GitLab Logo" />,
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/gitlab/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_gitlab_enabled,
    },
    {
      id: "gitea",
      text: withProvider("Gitea"),
      icon: <img src={giteaLogo} height={18} width={18} alt="Gitea Logo" />,
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/gitea/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_gitea_enabled,
    },
    {
      id: "oidc",
      text: withProvider(config?.oidc_provider_name || "OIDC"),
      icon: (
        <OIDCProviderIcon
          iconUrl={config?.oidc_provider_icon_url}
          providerName={config?.oidc_provider_name || "OIDC"}
        />
      ),
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/oidc/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_oidc_enabled,
    },
  ];

  return {
    isOAuthEnabled,
    oAuthOptions,
  };
};
