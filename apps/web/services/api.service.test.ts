import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "axios";
import { issueSync } from "@/lib/sync/issue-sync";
import { APIService } from "./api.service";

vi.mock("axios", async (importOriginal) => ({ ...(await importOriginal<typeof import("axios")>()), create: vi.fn() }));
vi.mock("@plane/services", () => ({ normalizeAPIRequestURL: (url: string) => url }));

class TestAPIService extends APIService {
  constructor() {
    super("");
  }
}

function setup(pathname: string, search = "", hash = "") {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { pathname, search, hash, replace } });
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
  vi.restoreAllMocks();
});

describe("issue query invalidation boundaries", () => {
  it.each([
    "/api/workspaces/w/projects/p/issues/i/custom-properties/",
    "/api/workspaces/w/projects/p/issues/i/collaboration/",
  ])("does not cancel independent schema or collaboration reads: %s", async (url) => {
    let revision = 1;
    vi.spyOn(issueSync, "revision", "get").mockImplementation(() => revision);
    let finish!: (value: unknown) => void;
    vi.mocked(create).mockReturnValue({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      get: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    } as unknown as ReturnType<typeof create>);
    const request = new TestAPIService().get(url);
    revision++;
    finish({ data: { ready: true } });
    await expect(request).resolves.toEqual({ data: { ready: true } });
  });

  it("still cancels an entity response crossing a mutation", async () => {
    let revision = 1;
    vi.spyOn(issueSync, "revision", "get").mockImplementation(() => revision);
    const invalidate = vi.spyOn(issueSync, "invalidate").mockImplementation(() => undefined);
    let finish!: (value: unknown) => void;
    vi.mocked(create).mockReturnValue({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      get: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    } as unknown as ReturnType<typeof create>);
    const request = new TestAPIService().get("/api/workspaces/w/projects/p/issues/i/");
    revision++;
    finish({ data: {} });
    await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(invalidate).toHaveBeenCalledOnce();
  });
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

  it("preserves the full private URL when an expired session redirects to login", async () => {
    const path = "/wuzuo/projects/project/issues/";
    const search = "?peekId=issue&projectId=project&filter=a%26b";
    const hash = "#description";
    const { replace, rejectResponse } = setup(path, search, hash);
    const error = { response: { status: 401 } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    const target = new URL(replace.mock.calls[0][0], "https://plane.test");
    expect(target.searchParams.get("next_path")).toBe(`${path}${search}${hash}`);
    expect([...target.searchParams.keys()]).toEqual(["next_path"]);
  });

  it.each([{ response: { status: 403 } }, new Error("Network error")])(
    "preserves other errors without redirecting",
    async (error) => {
      const { replace, rejectResponse } = setup("/workspace/projects");
      await expect(rejectResponse(error)).rejects.toBe(error);
      expect(replace).not.toHaveBeenCalled();
    }
  );
});
