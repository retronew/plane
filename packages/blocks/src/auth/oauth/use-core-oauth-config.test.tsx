import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IInstanceConfig, TOAuthOption } from "@plane/types";
import { useCoreOAuthConfig, type TOAuthProviderLogos } from "./use-core-oauth-config";

const logos: TOAuthProviderLogos = {
  google: "/google.png",
  githubLight: "/github-light.png",
  githubDark: "/github-dark.png",
  gitlab: "/gitlab.svg",
  gitea: "/gitea.svg",
};

const config = {
  is_google_enabled: true,
  is_github_enabled: true,
  is_gitlab_enabled: false,
  is_gitea_enabled: true,
  is_oidc_enabled: true,
  oidc_provider_name: "Casdoor",
} as IInstanceConfig;

const options = (resolvedTheme: string) =>
  renderHook(() =>
    useCoreOAuthConfig({
      config,
      oauthActionText: "Sign in",
      resolvedTheme,
      nextPath: "/wuzuo/",
      logos,
    })
  ).result.current.oAuthOptions;

type IconElement = { props: { src: string } };

const iconSrc = (list: TOAuthOption[], id: string) => {
  const option = list.find((item) => item.id === id);
  if (!option) return undefined;
  return (option.icon as IconElement).props.src;
};

it("picks the GitHub mark that matches the surface it renders on", () => {
  expect(iconSrc(options("dark"), "github")).toBe("/github-dark.png");
  expect(iconSrc(options("light"), "github")).toBe("/github-light.png");
});

it("marks providers from the instance config and skips the unconfigured ones", () => {
  const list = options("light");
  expect(list.find((option) => option.id === "gitlab")?.enabled).toBe(false);
  expect(list.find((option) => option.id === "gitea")?.enabled).toBe(true);
  expect(list.find((option) => option.id === "oidc")?.enabled).toBe(true);
});

it("sends each provider to its endpoint with the next_path", () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { assign, origin: "http://localhost" });

  const google = options("light").find((option) => option.id === "google");
  google?.onClick?.();
  expect(assign).toHaveBeenCalledWith(expect.stringContaining("/auth/google/?next_path=/wuzuo/"));

  vi.unstubAllGlobals();
});
