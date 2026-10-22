import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@plane/types";
import type { TNotificationPreferences } from "@plane/types";
import { NotificationPreferencesForm } from "./preferences-form";

const api = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock("@plane/services", () => ({
  NotificationPreferencesService: vi.fn(function () {
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
  Button: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>,
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
function mount(local = false) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <NotificationPreferencesForm scope={local ? { workspace_id: "workspace" } : {}} />
    </SWRConfig>
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("notification preferences", () => {
  it("saves channel switches and unified overrides as sparse global patches", async () => {
    const data = preferences();
    api.retrieve.mockResolvedValue(data);
    api.update.mockResolvedValue(data);
    mount();
    fireEvent.click(await screen.findByRole("switch", { name: "notification_preferences.channels.email" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ channels: { email: false } }, {}));
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "notification_preferences.channels.email" }).hasAttribute("disabled")
      ).toBe(false)
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "notification_preferences.channels.email · notification_preferences.force" })
    );
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ override_scopes: { email: true } }, {}));
    expect(screen.getAllByRole("row")).toHaveLength(9);
  });
  it("saves off and inherit distinctly and shows effective sources", async () => {
    const data = preferences(true);
    api.retrieve.mockResolvedValue(data);
    api.update.mockImplementation(async (patch) => ({
      ...data,
      events: { ...data.events, email: { ...data.events.email, ...patch.events.email } },
    }));
    mount(true);
    const input = await screen.findByRole("combobox", {
      name: "notification_preferences.cell_label notification_preferences.events.comment notification_preferences.channels.email",
    });
    fireEvent.change(input, { target: { value: "off" } });
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({ events: { email: { comment: false } } }, { workspace_id: "workspace" })
    );
    await waitFor(() => expect((input as HTMLSelectElement).value).toBe("off"));
    fireEvent.change(input, { target: { value: "inherit" } });
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({ events: { email: { comment: null } } }, { workspace_id: "workspace" })
    );
    expect(screen.getAllByText(/notification_preferences.sources.channel_disabled/)).toHaveLength(8);
  });
  it("keeps the last saved value when a request fails", async () => {
    api.retrieve.mockResolvedValue(preferences());
    api.update.mockRejectedValue(new Error("network"));
    mount();
    const input = await screen.findByRole("switch", { name: "notification_preferences.channels.email" });
    fireEvent.click(input);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((input as HTMLInputElement).checked).toBe(true);
  });
  it("renders a retry action after a load failure", async () => {
    api.retrieve.mockRejectedValueOnce(new Error("network")).mockResolvedValue(preferences());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.retry" }));
    expect(await screen.findByRole("switch", { name: "notification_preferences.channels.email" })).toBeTruthy();
  });
});
