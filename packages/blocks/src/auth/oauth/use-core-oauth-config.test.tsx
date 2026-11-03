import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());
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

const teamOptions = (overrides: Partial<IInstanceConfig> = {}) =>
  renderHook(() =>
    useCoreOAuthConfig({
      config: {
        ...config,
        oidc_login_entries: [
          { id: "chengdu", name: "成都水月雨科技飞书", enabled: true },
          { id: "moondrop", name: "水月雨飞书", enabled: true },
        ],
        ...overrides,
      },
      oauthActionText: "Sign in",
      resolvedTheme: "light",
      nextPath: "/workspace/?filter=a&other=b",
      logos,
    })
  ).result.current;

it("renders separate team entries and forwards only the entry ID with an encoded next_path", () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { assign, origin: "http://localhost" });
  const entries = teamOptions().oAuthOptions;
  expect(entries.some((option) => option.id === "oidc")).toBe(false);
  for (const id of ["chengdu", "moondrop"]) {
    const option = entries.find((item) => item.id === `oidc:${id}`);
    expect(option?.enabled).toBe(true);
    option?.onClick();
    const url = new URL(assign.mock.calls.at(-1)?.[0], "http://localhost");
    expect(url.pathname).toBe("/auth/oidc/");
    expect(url.searchParams.get("entry")).toBe(id);
    expect(url.searchParams.get("next_path")).toBe("/workspace/?filter=a&other=b");
    expect(url.searchParams.has("provider_hint")).toBe(false);
  }
});

it("does not restore the default button when all configured team entries are disabled", () => {
  const result = teamOptions({
    is_google_enabled: false,
    is_github_enabled: false,
    is_gitea_enabled: false,
    oidc_login_entries: [{ id: "disabled", name: "Disabled", enabled: false }],
  });
  expect(result.isOAuthEnabled).toBe(false);
  expect(result.oAuthOptions.find((option) => option.id === "oidc:disabled")?.enabled).toBe(false);
  expect(result.oAuthOptions.some((option) => option.id === "oidc")).toBe(false);
});

it("disables every team entry when OIDC is turned off", () => {
  expect(
    teamOptions({ is_oidc_enabled: false })
      .oAuthOptions.filter((option) => option.id.startsWith("oidc:"))
      .every((option) => !option.enabled)
  ).toBe(true);
});

it("keeps the legacy single entry for an unconfigured entry list", () => {
  expect(teamOptions({ oidc_login_entries: [] }).oAuthOptions.find((option) => option.id === "oidc")?.enabled).toBe(
    true
  );
});

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
