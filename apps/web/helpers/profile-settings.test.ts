import { describe, expect, it } from "vitest";
import { getProfileSettingsRedirect } from "./profile-settings";

describe("legacy personal settings redirect", () => {
  it("returns to a valid preferred workspace with the requested modal tab", () => {
    expect(getProfileSettingsRedirect("api-tokens", "", "", ["first", "preferred"], "preferred")).toBe(
      "/preferred?profileSettings=api-tokens"
    );
  });

  it("uses an accessible workspace when the remembered workspace was removed", () => {
    expect(getProfileSettingsRedirect("oauth-connections", "", "", ["first"], "removed")).toBe(
      "/first?profileSettings=oauth-connections"
    );
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
