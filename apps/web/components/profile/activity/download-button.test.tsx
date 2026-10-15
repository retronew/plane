import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { renderFormattedPayloadDate } from "@plane/utils";
import { DownloadActivityButton } from "./download-button";
const exportActivity = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", userId: "profile-user" }) }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    downloadProfileActivity = exportActivity;
  },
}));
beforeEach(async () => {
  await setLanguage("zh-CN");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await act(() => setLanguage("en"));
});
it("exports today's CSV for the selected profile, blocks duplicate requests and releases its download URL", async () => {
  let resolveRequest!: (value: string) => void;
  const request = new Promise<string>((resolve) => {
    resolveRequest = resolve;
  });
  exportActivity.mockReturnValueOnce(request);
  const createUrl = vi.fn((_blob: Blob) => "blob:test-export"),
    revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revoke;
    }
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<DownloadActivityButton />);
  fireEvent.click(screen.getByRole("button", { name: "导出今日活动" }));
  const busy = screen.getByRole("button", { name: "正在导出" });
  expect(busy.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(busy);
  expect(exportActivity).toHaveBeenCalledOnce();
  await act(async () => resolveRequest("id,title\n1,QA activity\n"));
  await waitFor(() => expect(createUrl).toHaveBeenCalledOnce());
  expect(exportActivity).toHaveBeenCalledWith("workspace", "profile-user", {
    date: renderFormattedPayloadDate(new Date()),
  });
  expect(createUrl.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(revoke).toHaveBeenCalledWith("blob:test-export");
  expect(document.querySelector("a[download]")).toBeNull();
});
