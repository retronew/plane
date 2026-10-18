/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
// plane imports
import type { TOAuthConfigs } from "@plane/types";
import { useCoreOAuthConfig as useSharedCoreOAuthConfig } from "@plane/blocks/auth";
// assets
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import githubDarkLogo from "@/app/assets/logos/github-dark.svg?url";
import githubLightLogo from "@/app/assets/logos/github-black.png?url";
import gitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import googleLogo from "@/app/assets/logos/google-logo.svg?url";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

export const useCoreOAuthConfig = (oauthActionText: string): TOAuthConfigs => {
  // router
  const searchParams = useSearchParams();
  // theme
  const { resolvedTheme } = useTheme();
  // store hooks
  const { config } = useInstance();

  return useSharedCoreOAuthConfig({
    config,
    oauthActionText,
    resolvedTheme,
    nextPath: searchParams.get("next_path"),
    logos: {
      google: googleLogo,
      githubLight: githubLightLogo,
      githubDark: githubDarkLogo,
      gitlab: gitlabLogo,
      gitea: giteaLogo,
    },
  });
};
