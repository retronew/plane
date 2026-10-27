import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { FeishuAccount } from "./feishu-account";
const state = vi.hoisted(() => ({
  feishuStatus: vi.fn(),
  testFeishu: vi.fn(),
}));
vi.mock("@plane/services", () => ({
  NotificationPreferencesService: vi.fn(function () {
    return state;
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
const linked = { enabled: true, binding: { display_name: "Person", app_id: "app", created_at: "2026-10-22" } };
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <FeishuAccount />
    </SWRConfig>
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  state.feishuStatus.mockResolvedValue(linked);
  state.testFeishu.mockResolvedValue({ status: "pending" });
});
it("queues a test while exposing no personal binding controls", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.feishu_test" }));
  expect(await screen.findByText("notification_preferences.feishu_queued")).toBeTruthy();
  expect(state.testFeishu).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "notification_preferences.feishu_unlink" })).toBeNull();
  expect(screen.queryByRole("button", { name: "notification_preferences.feishu_link" })).toBeNull();
});
it("shows an unbound account as read-only", async () => {
  state.feishuStatus.mockResolvedValue({ enabled: true, binding: null });
  mount();
  expect(await screen.findByText("notification_preferences.feishu_unlinked")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("notification_preferences.feishu_description")).toBeTruthy();
});
it("disables testing when instance delivery is disabled", async () => {
  state.feishuStatus.mockResolvedValue({ ...linked, enabled: false });
  mount();
  expect(
    (await screen.findByRole("button", { name: "notification_preferences.feishu_test" })).hasAttribute("disabled")
  ).toBe(true);
});
it("shows test failures without losing the binding", async () => {
  state.testFeishu.mockRejectedValue(new Error("network"));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.feishu_test" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("notification_preferences.feishu_linked")).toBeTruthy();
});
it.each(["connected", "identity_in_use", "error"])("ignores legacy OAuth callback result %s", async (result) => {
  window.history.replaceState({}, "", `/?feishu=${result}`);
  mount();
  await screen.findByText("notification_preferences.feishu_linked");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("notification_preferences.feishu_connected")).toBeNull();
});
it.each(["pending", "retry", "sent", "failed", "cancelled"])("shows the latest %s delivery state", async (status) => {
  state.feishuStatus.mockResolvedValue({ ...linked, last_delivery: { status, error: "internal error details" } });
  mount();
  expect(await screen.findByText(`notification_preferences.delivery.${status}`)).toBeTruthy();
  expect(screen.queryByText("internal error details")).toBeNull();
});
