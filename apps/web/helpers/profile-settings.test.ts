import { describe, expect, it } from "vitest";
import { matchRoutes } from "react-router";
import type { RouteObject } from "react-router";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import { coreRoutes } from "@/app/routes/core";
import { getProfileSettingsRedirect } from "./profile-settings";

function toRoutes(entries: RouteConfigEntry[]): RouteObject[] {
  return entries.map(({ file, path, index, children }) =>
    index ? { id: file, path, index: true } : { id: file, path, children: children ? toRoutes(children) : undefined }
  );
}

describe("Feishu notification settings callback routing", () => {
  it.each(["connected", "error", "identity_in_use"])("routes %s through standalone personal settings", (result) => {
    const matches = matchRoutes(toRoutes(coreRoutes), `/settings/profile/notifications/?feishu=${result}`);
    expect(matches?.at(-1)?.route.id).toBe("./(all)/settings/profile/[profileTabId]/page.tsx");
    expect(matches?.at(-1)?.params).toEqual({ profileTabId: "notifications" });
    expect(getProfileSettingsRedirect("notifications", `?feishu=${result}`, "", ["profile"])).toBe(
      `/profile?feishu=${result}&profileSettings=notifications`
    );
  });

  it("keeps the profile workspace notification inbox distinct from personal preferences", () => {
    const matches = matchRoutes(toRoutes(coreRoutes), "/profile/notifications/");
    expect(matches?.at(-1)?.route.id).toBe("./(all)/[workspaceSlug]/(projects)/notifications/page.tsx");
    expect(matches?.at(-1)?.params.workspaceSlug).toBe("profile");
  });
});

describe("legacy personal settings redirect", () => {
  it("returns to a valid preferred workspace with the requested modal tab", () => {
    expect(getProfileSettingsRedirect("api-tokens", "", "", ["first", "preferred"], "preferred")).toBe(
      "/preferred?profileSettings=api-tokens"
    );
  });

  it("uses an accessible workspace when the remembered workspace was removed", () => {
    expect(getProfileSettingsRedirect("mcp", "", "", ["first"], "removed")).toBe("/first?profileSettings=mcp");
  });

  it("supports accounts without workspaces and normalizes unknown tabs", () => {
    expect(getProfileSettingsRedirect("unknown", "", "", [])).toBe("/create-workspace?profileSettings=general");
  });

  it("defaults the settings root URL to general", () => {
    expect(getProfileSettingsRedirect(undefined, "", "", [])).toBe("/create-workspace?profileSettings=general");
  });

  it("preserves SSO success, suggested email, unrelated query and hash", () => {
    const result = new URL(
      getProfileSettingsRedirect("general", "?oidc_linked=1&oidc_email=a%2Bb%40example.com&other=keep", "#return", [
        "team",
      ]),
      "https://plane.test"
    );
    expect(result.searchParams.get("oidc_linked")).toBe("1");
    expect(result.searchParams.get("oidc_email")).toBe("a+b@example.com");
    expect(result.searchParams.get("other")).toBe("keep");
    expect(result.hash).toBe("#return");
  });

  it("preserves SSO errors while replacing an untrusted modal marker", () => {
    expect(getProfileSettingsRedirect("general", "?error_code=failed&profileSettings=unknown", "", [])).toBe(
      "/create-workspace?error_code=failed&profileSettings=general"
    );
  });
});
