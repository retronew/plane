import { beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthenticate } from "@/lib/auth";
import type { HocusPocusServerContext } from "@/types";
const mocks = vi.hoisted(() => ({ user: vi.fn(), page: vi.fn() }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    currentUser = mocks.user;
  },
}));
vi.mock("@/services/page/handler", () => ({ getPageService: () => ({ fetchDetails: mocks.page }) }));
vi.mock("@plane/logger", () => ({ logger: { error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user", display_name: "User" });
});
const authenticate = () =>
  onAuthenticate({
    requestHeaders: { cookie: "session=test" },
    requestParameters: new URLSearchParams({
      documentType: "project_page",
      workspaceSlug: "workspace",
      projectId: "source",
    }),
    context: {} as HocusPocusServerContext,
    token: JSON.stringify({ id: "user" }),
    documentName: "page",
  });
describe("Moved document access", () => {
  it("checks the page on every connection even when the server has already loaded it", async () => {
    mocks.page.mockResolvedValue({});
    await authenticate();
    await authenticate();
    expect(mocks.page).toHaveBeenCalledTimes(2);
    expect(mocks.page).toHaveBeenCalledWith("page");
  });
  it("rejects a source-project connection after the page has moved", async () => {
    mocks.page.mockRejectedValue(new Error("forbidden"));
    await expect(authenticate()).rejects.toThrow("forbidden");
  });
});
