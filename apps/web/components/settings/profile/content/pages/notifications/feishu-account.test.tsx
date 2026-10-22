import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { FeishuAccount } from "./feishu-account";
const state = vi.hoisted(() => ({
  feishuStatus: vi.fn(),
  unlinkFeishu: vi.fn(),
  testFeishu: vi.fn(),
  authorizeFeishu: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@plane/services", () => ({
  NotificationPreferencesService: vi.fn(function () {
    return state;
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ replace: state.replace }) }));
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
  state.unlinkFeishu.mockResolvedValue(undefined);
});
it("queues a test and refreshes status after unlinking", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.feishu_test" }));
  expect(await screen.findByText("notification_preferences.feishu_queued")).toBeTruthy();
  state.feishuStatus.mockResolvedValue({ enabled: true, binding: null });
  fireEvent.click(screen.getByRole("button", { name: "notification_preferences.feishu_unlink" }));
  expect(await screen.findByRole("button", { name: "notification_preferences.feishu_link" })).toBeTruthy();
  expect(state.unlinkFeishu).toHaveBeenCalledOnce();
});
it("disables linking when instance delivery is disabled", async () => {
  state.feishuStatus.mockResolvedValue({ enabled: false, binding: null });
  mount();
  expect(
    (await screen.findByRole("button", { name: "notification_preferences.feishu_link" })).hasAttribute("disabled")
  ).toBe(true);
});
it("shows action failures without losing the binding", async () => {
  state.testFeishu.mockRejectedValue(new Error("network"));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.feishu_test" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "notification_preferences.feishu_unlink" })).toBeTruthy();
});
it("consumes only the Feishu callback parameter", async () => {
  window.history.replaceState({}, "", "/workspace?profileSettings=notifications&feishu=connected&keep=1#section");
  mount();
  await waitFor(() =>
    expect(state.replace).toHaveBeenCalledWith("/workspace?profileSettings=notifications&keep=1#section")
  );
  expect(screen.getByText("notification_preferences.feishu_connected")).toBeTruthy();
});
it("explains when the Feishu identity is already linked elsewhere", () => {
  window.history.replaceState({}, "", "/?feishu=identity_in_use");
  mount();
  expect(screen.getByRole("alert").textContent).toBe("notification_preferences.feishu_identity_in_use");
});
it.each(["pending", "retry", "sent", "failed", "cancelled"])("shows the latest %s delivery state", async (status) => {
  state.feishuStatus.mockResolvedValue({ ...linked, last_delivery: { status, error: "internal error details" } });
  mount();
  expect(await screen.findByText(`notification_preferences.delivery.${status}`)).toBeTruthy();
  expect(screen.queryByText("internal error details")).toBeNull();
});
it("requests authorization and rejects unsafe redirect URLs", async () => {
  state.feishuStatus.mockResolvedValue({ enabled: true, binding: null });
  state.authorizeFeishu.mockResolvedValue({ authorization_url: "javascript:alert(1)" });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.feishu_link" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(state.authorizeFeishu).toHaveBeenCalledOnce();
});
