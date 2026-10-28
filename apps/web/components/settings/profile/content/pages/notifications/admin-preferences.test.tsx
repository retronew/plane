import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@plane/types";
import type { TNotificationPreferences } from "@plane/types";
import { UserNotificationPreferences } from "../../../../../../../admin/components/users/notification-preferences";
import { UserNotificationPreferencesDialog } from "../../../../../../../admin/components/users/notification-preferences-dialog";

const api = vi.hoisted(() => ({ getUserNotificationPreferences: vi.fn(), updateUserNotificationPreferences: vi.fn() }));
vi.mock("@plane/services", () => ({
  InstanceService: vi.fn(function () {
    return api;
  }),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, string>) => (args ? `${key} ${Object.values(args).join(" ")}` : key),
  }),
}));
vi.mock("@makeplane/propel/components/switch", () => ({
  Switch: ({
    checked,
    disabled,
    onCheckedChange,
    "aria-label": label,
  }: {
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (value: boolean) => void;
    "aria-label": string;
  }) => (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
function preferences(local = false): TNotificationPreferences {
  return {
    scope: local ? { workspace_id: "workspace" } : {},
    channels: { in_app: true, email: true, feishu: false },
    override_scopes: { in_app: false, email: false, feishu: false },
    events: Object.fromEntries(
      NOTIFICATION_CHANNELS.map((channel) => [
        channel,
        Object.fromEntries(NOTIFICATION_EVENTS.map((event) => [event, local ? null : true])),
      ])
    ) as TNotificationPreferences["events"],
    effective: Object.fromEntries(
      NOTIFICATION_CHANNELS.map((channel) => [
        channel,
        Object.fromEntries(
          NOTIFICATION_EVENTS.map((event) => [
            event,
            { enabled: channel !== "feishu", source: channel === "feishu" ? "channel_disabled" : "global" },
          ])
        ),
      ])
    ) as TNotificationPreferences["effective"],
  };
}

function mount(userId = "alice", busy = vi.fn()) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <UserNotificationPreferences key={userId} userId={userId} disabled={false} onBusyChange={busy} />
    </SWRConfig>
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.getUserNotificationPreferences.mockResolvedValue(preferences());
});
describe("admin user notification preferences", () => {
  it("blocks dialog dismissal during saving and allows it after completion", async () => {
    let complete!: (value: TNotificationPreferences) => void;
    api.updateUserNotificationPreferences.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const onClose = vi.fn();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <UserNotificationPreferencesDialog userId="alice" email="alice@example.com" isOpen onClose={onClose} />
      </SWRConfig>
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    fireEvent.click(
      await screen.findByRole("switch", { name: "notification_preferences.channels.feishu", exact: true })
    );
    const close = screen.getByRole("button", { name: "admin.common.close" });
    expect((close as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(close);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    complete(preferences());
    await waitFor(() => expect((close as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("loads selected user and sends a sparse channel patch", async () => {
    api.updateUserNotificationPreferences.mockResolvedValue(preferences());
    const busy = vi.fn();
    mount("alice", busy);
    fireEvent.click(
      await screen.findByRole("switch", { name: "notification_preferences.channels.feishu", exact: true })
    );
    await waitFor(() =>
      expect(api.updateUserNotificationPreferences).toHaveBeenCalledWith("alice", { channels: { feishu: true } })
    );
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
    expect(busy).toHaveBeenCalledWith(true);
  });
  it("isolates cached preferences when switching users", async () => {
    const alice = preferences();
    alice.channels.feishu = true;
    api.getUserNotificationPreferences.mockImplementation(async (userId: string) =>
      userId === "alice" ? alice : preferences()
    );
    const cache = new Map();
    const view = (userId: string) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
        <UserNotificationPreferences key={userId} userId={userId} disabled={false} onBusyChange={vi.fn()} />
      </SWRConfig>
    );
    const mounted = render(view("alice"));
    const name = "notification_preferences.channels.feishu";
    await waitFor(() =>
      expect(screen.getByRole("switch", { name, exact: true }).getAttribute("aria-checked")).toBe("true")
    );
    mounted.rerender(view("bob"));
    await waitFor(() =>
      expect(screen.getByRole("switch", { name, exact: true }).getAttribute("aria-checked")).toBe("false")
    );
    expect(api.getUserNotificationPreferences).toHaveBeenLastCalledWith("bob");
  });
  it("disables controls while a patch is pending", async () => {
    let complete!: (value: TNotificationPreferences) => void;
    api.updateUserNotificationPreferences.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    mount();
    const control = await screen.findByRole("switch", {
      name: "notification_preferences.channels.feishu",
      exact: true,
    });
    fireEvent.click(control);
    await waitFor(() => expect((control as HTMLInputElement).disabled).toBe(true));
    complete(preferences());
    await waitFor(() => expect((control as HTMLInputElement).disabled).toBe(false));
  });
  it("retries load failures for the same target", async () => {
    api.getUserNotificationPreferences.mockRejectedValueOnce(new Error("offline"));
    mount("bob");
    fireEvent.click(await screen.findByText("notification_preferences.retry"));
    await screen.findByRole("switch", { name: "notification_preferences.channels.feishu", exact: true });
    expect(api.getUserNotificationPreferences).toHaveBeenLastCalledWith("bob");
  });
  it("keeps the existing value after save failure and permits retry", async () => {
    api.updateUserNotificationPreferences.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(preferences());
    mount();
    const control = await screen.findByRole("switch", {
      name: "notification_preferences.channels.feishu",
      exact: true,
    });
    fireEvent.click(control);
    await screen.findByText("notification_preferences.save_error");
    expect(control.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(control);
    await waitFor(() => expect(api.updateUserNotificationPreferences).toHaveBeenCalledTimes(2));
  });
});
