import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/app-loader", () => ({ AppLoader: () => null }));
vi.mock("@/helpers/authentication.helper", () => ({ EPageTypes: {} }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/store/user", () => ({ useUser: vi.fn(), useUserProfile: vi.fn(), useUserSettings: vi.fn() }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: vi.fn() }));
vi.mock("@plane/utils", () => ({ isValidNextPath: vi.fn() }));

import { getUnauthenticatedRedirectUrl } from "./authentication-wrapper";

describe("authentication return address", () => {
  it("encodes the complete personal settings callback as a single next_path", () => {
    const path = "/settings/profile/general/";
    const search = "oidc_linked=1&oidc_email=a%2Bb%40example.com&other=keep";
    const result = new URL(getUnauthenticatedRedirectUrl(path, search, "#return"), "https://plane.test");
    expect(result.searchParams.get("next_path")).toBe(`${path}?${search}#return`);
    expect([...result.searchParams.keys()]).toEqual(["next_path"]);
  });

  it("preserves ordinary authenticated routes", () => {
    expect(new URL(getUnauthenticatedRedirectUrl("/team"), "https://plane.test").searchParams.get("next_path")).toBe(
      "/team"
    );
  });
});
