import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "axios";
import { APIService } from "./api.service";

vi.mock("axios", () => ({ create: vi.fn() }));
vi.mock("@plane/services", () => ({ normalizeAPIRequestURL: (url: string) => url }));

class TestAPIService extends APIService {
  constructor() {
    super("");
  }
}

function setup(pathname: string) {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { pathname, replace } });
  const responseUse = vi.fn();
  vi.mocked(create).mockReturnValue({
    interceptors: { request: { use: vi.fn() }, response: { use: responseUse } },
  } as unknown as ReturnType<typeof create>);
  const service = new TestAPIService();
  expect(service).toBeInstanceOf(APIService);
  const rejectResponse = responseUse.mock.calls[0][1] as (error: unknown) => Promise<never>;
  return { replace, rejectResponse };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("API authentication redirects", () => {
  it.each([
    "/",
    "/sign-up",
    "/sign-up/",
    "/accounts/forgot-password",
    "/accounts/reset-password/",
    "/accounts/oidc/bind-email",
    "/accounts/oidc/bind-email/",
  ])("keeps anonymous users on the public auth page %s", async (pathname) => {
    const { replace, rejectResponse } = setup(pathname);
    const error = { response: { status: 401 } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["/workspace/projects", "/onboarding", "/accounts/set-password", "/accounts/oidc/bind-email/private"])(
    "redirects anonymous users from the private page %s",
    async (pathname) => {
      const { replace, rejectResponse } = setup(pathname);
      const error = { response: { status: 401 } };
      await expect(rejectResponse(error)).rejects.toBe(error);
      expect(replace).toHaveBeenCalledWith(`/?next_path=${encodeURIComponent(pathname)}`);
    }
  );

  it.each([{ response: { status: 403 } }, new Error("Network error")])(
    "preserves other errors without redirecting",
    async (error) => {
      const { replace, rejectResponse } = setup("/workspace/projects");
      await expect(rejectResponse(error)).rejects.toBe(error);
      expect(replace).not.toHaveBeenCalled();
    }
  );
});
