import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { FeishuAccount } from "./feishu-account";
const state = vi.hoisted(() => ({ feishuStatus: vi.fn(), testFeishu: vi.fn() }));
vi.mock("@plane/services", () => ({
  NotificationPreferencesService: vi.fn(function () {
    return state;
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
  state.feishuStatus.mockResolvedValue(linked);
});
it("keeps binding status and administrator guidance inside the Feishu box without testing controls", async () => {
  mount();
  const status = await screen.findByText("notification_preferences.feishu_linked");
  const box = screen.getByRole("heading", { name: /notification_preferences.channels.feishu/ }).parentElement!
    .parentElement!;
  expect(box.contains(status)).toBe(true);
  expect(box.contains(screen.getByText("notification_preferences.feishu_description"))).toBe(true);
  expect(screen.queryByRole("button")).toBeNull();
  expect(state.testFeishu).not.toHaveBeenCalled();
});
it("shows an unbound account as read-only", async () => {
  state.feishuStatus.mockResolvedValue({ enabled: true, binding: null });
  mount();
  expect(await screen.findByText("notification_preferences.feishu_unlinked")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("keeps disabled information inside the box", async () => {
  state.feishuStatus.mockResolvedValue({ ...linked, enabled: false });
  mount();
  const disabled = await screen.findByText("notification_preferences.feishu_disabled");
  const box = screen.getByRole("heading").parentElement!.parentElement!;
  expect(box.contains(disabled)).toBe(true);
});
it("allows retrying a status load failure", async () => {
  state.feishuStatus.mockRejectedValueOnce(new Error("network"));
  mount();
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "notification_preferences.retry" }));
  expect(await screen.findByText("notification_preferences.feishu_linked")).toBeTruthy();
});
it.each(["pending", "retry", "sent", "failed", "cancelled"])("hides the latest %s delivery state", async (status) => {
  state.feishuStatus.mockResolvedValue({ ...linked, last_delivery: { status, error: "internal error details" } });
  mount();
  await screen.findByText("notification_preferences.feishu_linked");
  expect(screen.queryByText(`notification_preferences.delivery.${status}`)).toBeNull();
  expect(screen.queryByText("internal error details")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
