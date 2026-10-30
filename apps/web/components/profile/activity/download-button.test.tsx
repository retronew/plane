import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { DownloadActivityButton } from "./download-button";
const exportActivity = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", userId: "profile-user" }) }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    downloadProfileActivity = exportActivity;
  },
}));
beforeEach(async () => {
  exportActivity.mockReset();
  await setLanguage("zh-CN");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await act(() => setLanguage("en"));
});
it("downloads today's historical-state CSV and releases its URL", async () => {
  exportActivity
    .mockResolvedValueOnce({
      count: 1,
      timezone: "Asia/Shanghai",
      start_date: "2026-10-27",
      end_date: "2026-10-27",
      results: [],
    })
    .mockResolvedValueOnce("Project,Identifier,Name,Final state\nP,P-1,Task,In progress\n");
  const createUrl = vi.fn(() => "blob:test-export"),
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
  await waitFor(() => expect(createUrl).toHaveBeenCalledOnce());
  expect(exportActivity).toHaveBeenNthCalledWith(1, "workspace", "profile-user", { period: "today", preview: true });
  expect(exportActivity).toHaveBeenNthCalledWith(2, "workspace", "profile-user", { period: "today" });
  expect(createUrl.mock.calls[0]).toHaveLength(1);
  expect(revoke).toHaveBeenCalledWith("blob:test-export");
  expect(document.querySelector("a[download]")).toBeNull();
});
it("shows empty feedback without downloading an empty report", async () => {
  exportActivity.mockResolvedValueOnce({
    count: 0,
    timezone: "UTC",
    start_date: "2026-10-27",
    end_date: "2026-10-27",
    results: [],
  });
  render(<DownloadActivityButton />);
  fireEvent.click(screen.getByRole("button", { name: "导出今日活动" }));
  expect(await screen.findByText("此日期范围内没有状态变化。")).toBeTruthy();
  expect(exportActivity).toHaveBeenCalledOnce();
});
it("reports failed requests and allows retry", async () => {
  exportActivity.mockRejectedValueOnce(new Error("network"));
  render(<DownloadActivityButton />);
  fireEvent.click(screen.getByRole("button", { name: "导出今日活动" }));
  expect(await screen.findByText("无法导出活动，请重试。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "导出今日活动" }).getAttribute("aria-disabled")).not.toBe("true");
});
