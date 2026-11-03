import { useState } from "react";
// plane imports
import { API_BASE_URL } from "@plane/constants";
import { translate, useTranslation } from "@plane/i18n";
import { LockOutline } from "@makeplane/propel/icons";
import type { IInstanceConfig, TOAuthConfigs, TOAuthOption } from "@plane/types";

/** Provider logos, owned by the app that renders the buttons. */
export type TOAuthProviderLogos = {
  google: string;
  githubLight: string;
  githubDark: string;
  gitlab: string;
  gitea: string;
};

type Options = {
  config: IInstanceConfig | undefined;
  /** Wording of the button label, e.g. "Sign in" or "Sign up". */
  oauthActionText: string;
  /** Resolved theme, so the GitHub mark matches the surface it sits on. */
  resolvedTheme: string | undefined;
  /** `next_path` query value forwarded to the OAuth endpoints. */
  nextPath: string | null;
  oidcPath?: "/auth/oidc/" | "/auth/spaces/oidc/";
  logos: TOAuthProviderLogos;
};

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
      alt={translate("web.runtime.provider_logo", { name: providerName })}
      onError={() => setFailedUrl(iconUrl)}
    />
  );
}

/**
 * The instance-configured OAuth buttons, shared by the web and space auth screens. Everything
 * app-specific (instance config, theme, query params, logo assets) comes in through the options.
 */
export const useCoreOAuthConfig = ({
  config,
  oauthActionText,
  resolvedTheme,
  nextPath,
  oidcPath = "/auth/oidc/",
  logos,
}: Options): TOAuthConfigs => {
  // translation
  const { t } = useTranslation();
  // derived values
  const withProvider = (provider: string) => t("web.oauth_action_with_provider", { action: oauthActionText, provider });
  const oidcEntries = config?.oidc_login_entries?.length
    ? config.oidc_login_entries
    : [{ id: "", name: config?.oidc_provider_name || "OIDC", icon_url: config?.oidc_provider_icon_url, enabled: true }];
  const isOAuthEnabled =
    (config &&
      (config?.is_google_enabled ||
        config?.is_github_enabled ||
        config?.is_gitlab_enabled ||
        config?.is_gitea_enabled ||
        (config?.is_oidc_enabled && oidcEntries.some((entry) => entry.enabled)))) ||
    false;
  const oAuthOptions: TOAuthOption[] = [
    {
      id: "google",
      text: withProvider("Google"),
      icon: <img src={logos.google} height={18} width={18} alt="Google Logo" />,
      onClick: () => {
        window.location.assign(
          `${API_BASE_URL}/auth/google/${nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : ``}`
        );
      },
      enabled: config?.is_google_enabled,
    },
    {
      id: "github",
      text: withProvider("GitHub"),
      icon: (
        <img
          src={resolvedTheme === "dark" ? logos.githubDark : logos.githubLight}
          height={18}
          width={18}
          alt="GitHub Logo"
        />
      ),
      onClick: () => {
        window.location.assign(
          `${API_BASE_URL}/auth/github/${nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : ``}`
        );
      },
      enabled: config?.is_github_enabled,
    },
    {
      id: "gitlab",
      text: withProvider("GitLab"),
      icon: <img src={logos.gitlab} height={18} width={18} alt="GitLab Logo" />,
      onClick: () => {
        window.location.assign(
          `${API_BASE_URL}/auth/gitlab/${nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : ``}`
        );
      },
      enabled: config?.is_gitlab_enabled,
    },
    {
      id: "gitea",
      text: withProvider("Gitea"),
      icon: <img src={logos.gitea} height={18} width={18} alt="Gitea Logo" />,
      onClick: () => {
        window.location.assign(
          `${API_BASE_URL}/auth/gitea/${nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : ``}`
        );
      },
      enabled: config?.is_gitea_enabled,
    },
    ...oidcEntries.map((entry) => ({
      id: entry.id ? `oidc:${entry.id}` : "oidc",
      text: withProvider(entry.name),
      icon: <OIDCProviderIcon iconUrl={entry.icon_url || config?.oidc_provider_icon_url} providerName={entry.name} />,
      onClick: () => {
        const params = new URLSearchParams();
        if (entry.id) params.set("entry", entry.id);
        if (nextPath) params.set("next_path", nextPath);
        window.location.assign(`${API_BASE_URL}${oidcPath}${params.size ? `?${params}` : ""}`);
      },
      enabled: !!config?.is_oidc_enabled && entry.enabled,
    })),
  ];

  return {
    isOAuthEnabled,
    oAuthOptions,
  };
};
