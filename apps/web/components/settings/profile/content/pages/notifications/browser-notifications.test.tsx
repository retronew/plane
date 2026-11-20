import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserNotificationsSettings } from "./browser-notifications";

const state = vi.hoisted(() => ({
  enabled: true,
  supported: true,
  permission: "default" as NotificationPermission | "unsupported",
  error: false,
  busy: false,
  setEnabled: vi.fn(),
  requestPermission: vi.fn(),
  sendTest: vi.fn(),
}));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-browser-notifications", () => ({ useBrowserNotifications: () => state }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.clearAllMocks();
  Object.assign(state, { enabled: true, supported: true, permission: "default", error: false, busy: false });
  state.requestPermission.mockResolvedValue(undefined);
  state.sendTest.mockResolvedValue(undefined);
});

const key = (value: string) => `notification_preferences.browser.${value}`;

it("shows the enabled preference, account scope and delivery limitations without requesting permission", () => {
  render(<BrowserNotificationsSettings />);
  expect(screen.getByRole("switch", { name: key("enabled") }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText(key("enabled_description"))).toBeTruthy();
  expect(screen.getByText(key("availability"))).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain(key("status.default"));
  expect(state.requestPermission).not.toHaveBeenCalled();
  expect(state.sendTest).not.toHaveBeenCalled();
});

it.each([true, false])("updates an enabled=%s preference without implicitly requesting permission", (enabled) => {
  state.enabled = enabled;
  render(<BrowserNotificationsSettings />);
  fireEvent.click(screen.getByRole("switch", { name: key("enabled") }));
  expect(state.setEnabled).toHaveBeenCalledTimes(1);
  expect(state.setEnabled.mock.calls[0][0]).toBe(!enabled);
  expect(state.requestPermission).not.toHaveBeenCalled();
});

it("requests permission only when Allow notifications is clicked", () => {
  render(<BrowserNotificationsSettings />);
  expect(state.requestPermission).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: key("test") }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: key("allow") }));
  expect(state.requestPermission).toHaveBeenCalledTimes(1);
  expect(state.sendTest).not.toHaveBeenCalled();
});

it("shows granted permission and sends a test only on click", () => {
  state.permission = "granted";
  render(<BrowserNotificationsSettings />);
  expect(screen.getByRole("status").textContent).toContain(key("status.granted"));
  expect(screen.queryByRole("button", { name: key("allow") })).toBeNull();
  expect(state.sendTest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: key("test") }));
  expect(state.sendTest).toHaveBeenCalledTimes(1);
});

it("explains denied permission without offering another permission prompt", () => {
  state.permission = "denied";
  render(<BrowserNotificationsSettings />);
  expect(screen.getByRole("status").textContent).toContain(key("status.denied"));
  expect(screen.getByText(key("status_description.denied"))).toBeTruthy();
  expect(screen.queryByRole("button", { name: key("allow") })).toBeNull();
  const testButton = screen.getByRole("button", { name: key("test") }) as HTMLButtonElement;
  expect(testButton.disabled).toBe(true);
  fireEvent.click(testButton);
  expect(state.sendTest).not.toHaveBeenCalled();
  expect(state.requestPermission).not.toHaveBeenCalled();
});

it("explains unsupported browsers and disables notification controls", () => {
  state.supported = false;
  state.permission = "unsupported";
  render(<BrowserNotificationsSettings />);
  expect(screen.getByRole("status").textContent).toContain(key("status.unsupported"));
  expect(screen.getByText(key("status_description.unsupported"))).toBeTruthy();
  expect(screen.getByRole("switch").getAttribute("aria-disabled")).toBe("true");
  expect((screen.getByRole("button", { name: key("test") }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: key("allow") })).toBeNull();
  expect(state.requestPermission).not.toHaveBeenCalled();
});

it.each(["default", "granted"] as const)(
  "disables actions when the preference is off with %s permission",
  (permission) => {
    state.enabled = false;
    state.permission = permission;
    render(<BrowserNotificationsSettings />);
    expect((screen.getByRole("button", { name: key("test") }) as HTMLButtonElement).disabled).toBe(true);
    if (permission === "default") {
      expect((screen.getByRole("button", { name: key("allow") }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByRole("switch").getAttribute("aria-disabled")).not.toBe("true");
  }
);

it.each(["default", "granted"] as const)("disables controls while busy with %s permission", (permission) => {
  state.busy = true;
  state.permission = permission;
  render(<BrowserNotificationsSettings />);
  expect(screen.getByRole("switch").getAttribute("aria-disabled")).toBe("true");
  expect((screen.getByRole("button", { name: key("test") }) as HTMLButtonElement).disabled).toBe(true);
  if (permission === "default") {
    expect((screen.getByRole("button", { name: key("allow") }) as HTMLButtonElement).disabled).toBe(true);
  }
});

it("announces a test-send error and keeps a retry available", async () => {
  state.permission = "granted";
  state.sendTest.mockImplementation(async () => {
    state.error = true;
  });
  const { rerender } = render(<BrowserNotificationsSettings />);
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: key("test") }));
  await waitFor(() => expect(state.sendTest).toHaveBeenCalledTimes(1));
  rerender(<BrowserNotificationsSettings />);
  expect(screen.getByRole("alert").textContent).toBe(key("error"));
  expect((screen.getByRole("button", { name: key("test") }) as HTMLButtonElement).disabled).toBe(false);
  state.error = false;
  rerender(<BrowserNotificationsSettings />);
  expect(screen.queryByRole("alert")).toBeNull();
});
