import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { TDailyDigestSettings, TDailyDigestPreview } from "@plane/types";
import { DailyDigestSettings } from "./daily-digest";

const api = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn(), preview: vi.fn() }));
vi.mock("@plane/services", () => ({
  DailyDigestService: vi.fn(function () {
    return api;
  }),
}));
vi.mock("./digest-scope", () => ({ DigestScope: () => null }));
vi.mock("./digest-preview", () => ({
  DigestPreview: ({ digest }: { digest: TDailyDigestPreview }) => (
    <div>{digest.sections.map((section) => `${section.key}: ${section.count}`).join(", ")}</div>
  ),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, unknown>) => (args ? `${key} ${Object.values(args).join(" ")}` : key),
  }),
}));

let settings: TDailyDigestSettings;
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <DailyDigestSettings />
    </SWRConfig>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("PointerEvent", MouseEvent);
  settings = {
    enabled: false,
    send_time: "18:00",
    weekdays_only: false,
    channels: ["in_app"],
    workspace_ids: [],
    project_ids: [],
    modules: ["completed", "open", "overdue", "due_today"],
    include_details: true,
    send_empty: false,
    due_soon_days: 3,
    timezone: "Asia/Shanghai",
  };
  api.retrieve.mockImplementation(async () => structuredClone(settings));
  api.update.mockImplementation(async (patch: Partial<TDailyDigestSettings>) => {
    settings = { ...settings, ...patch };
    return structuredClone(settings);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("defaults off and persists sparse content and schedule changes", async () => {
  mount();
  const enabled = await screen.findByRole("switch", { name: "notification_preferences.digest.enabled" });
  expect(enabled.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("switch", { name: "notification_preferences.digest.modules.completed" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ modules: ["open", "overdue", "due_today"] }));
  await screen.findByText("notification_preferences.digest.saved");
  fireEvent.click(screen.getByRole("switch", { name: "notification_preferences.digest.weekdays_only" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ weekdays_only: true }));
});

it("keeps the last channel and module selected while enabled", async () => {
  settings.enabled = true;
  settings.modules = ["overdue"];
  mount();
  const module = await screen.findByRole("switch", { name: "notification_preferences.digest.modules.overdue" });
  expect(module.getAttribute("aria-disabled")).toBe("true");
  expect(
    screen
      .getByRole("switch", {
        name: "notification_preferences.digest.channel_label notification_preferences.channels.in_app",
      })
      .getAttribute("aria-disabled")
  ).toBe("true");
  fireEvent.click(module);
  expect(api.update).not.toHaveBeenCalled();
});

it("restores the saved setting and reports a failed save", async () => {
  api.update.mockRejectedValueOnce(new Error("offline"));
  mount();
  const enabled = await screen.findByRole("switch", { name: "notification_preferences.digest.enabled" });
  fireEvent.click(enabled);
  expect((await screen.findByRole("alert")).textContent).toContain("notification_preferences.save_error");
  expect(enabled.getAttribute("aria-checked")).toBe("false");
});

it("previews saved settings without enabling or sending and invalidates stale previews", async () => {
  let resolvePreview!: (value: TDailyDigestPreview) => void;
  api.preview.mockImplementationOnce(
    () =>
      new Promise<TDailyDigestPreview>((resolve) => {
        resolvePreview = resolve;
      })
  );
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.digest.preview" }));
  await waitFor(() => expect(api.preview).toHaveBeenCalledTimes(1));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: "notification_preferences.digest.include_details" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ include_details: false }));
  await act(async () =>
    resolvePreview({
      period_start: "2026-11-04T10:00:00Z",
      period_end: "2026-11-05T10:00:00Z",
      timezone: "Asia/Shanghai",
      sections: [{ key: "overdue", count: 2, items: [] }],
    })
  );
  expect(screen.queryByText("overdue: 2")).toBeNull();
});

it("shows a retry action when settings cannot load", async () => {
  api.retrieve.mockRejectedValueOnce(new Error("offline"));
  mount();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "notification_preferences.retry" }));
  expect(await screen.findByRole("switch", { name: "notification_preferences.digest.enabled" })).toBeTruthy();
});

it("keeps an existing preview mounted while a setting saves", async () => {
  api.preview.mockResolvedValue({
    period_start: "2026-11-04T10:00:00Z",
    period_end: "2026-11-05T10:00:00Z",
    timezone: "UTC",
    sections: [{ key: "open", count: 12, items: [] }],
  });
  let finish!: (value: TDailyDigestSettings) => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise<TDailyDigestSettings>((resolve) => {
        finish = resolve;
      })
  );
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "notification_preferences.digest.preview" }));
  const preview = await screen.findByText("open: 12");
  fireEvent.click(screen.getByRole("switch", { name: "notification_preferences.digest.include_details" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ include_details: false }));
  expect(screen.getByText("open: 12")).toBe(preview);
  expect(screen.getByText("notification_preferences.digest.preview_stale")).toBeTruthy();
  expect(
    screen.getByRole("switch", { name: "notification_preferences.digest.weekdays_only" }).getAttribute("aria-disabled")
  ).not.toBe("true");
  await act(async () => finish({ ...settings, include_details: false }));
  expect(screen.getByText("open: 12")).toBe(preview);
});

it("serializes rapid changes without dropping input or flashing older responses", async () => {
  let finish!: (value: TDailyDigestSettings) => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise<TDailyDigestSettings>((resolve) => {
        finish = resolve;
      })
  );
  mount();
  const details = await screen.findByRole("switch", { name: "notification_preferences.digest.include_details" });
  const weekdays = screen.getByRole("switch", { name: "notification_preferences.digest.weekdays_only" });
  fireEvent.click(details);
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  fireEvent.click(weekdays);
  expect(weekdays.getAttribute("aria-checked")).toBe("true");
  expect(api.update).toHaveBeenCalledTimes(1);
  await act(async () => {
    settings = { ...settings, include_details: false };
    finish(structuredClone(settings));
  });
  await waitFor(() => expect(api.update).toHaveBeenNthCalledWith(2, { weekdays_only: true }));
  await screen.findByText("notification_preferences.digest.saved");
  expect(details.getAttribute("aria-checked")).toBe("false");
  expect(weekdays.getAttribute("aria-checked")).toBe("true");
});
