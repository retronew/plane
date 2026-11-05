import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NotificationsProfileSettings } from "./root";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./preferences-tab", () => ({
  NotificationPreferencesTab: function Preferences() {
    const [selected, setSelected] = useState(false);
    return <button onClick={() => setSelected(true)}>{selected ? "workspace selected" : "choose workspace"}</button>;
  },
}));
vi.mock("./daily-digest", () => ({ DailyDigestSettings: () => <h3>Digest settings</h3> }));
vi.mock("./feishu-account", () => ({ FeishuAccount: () => <h4>Feishu binding status</h4> }));
beforeEach(() => vi.stubGlobal("PointerEvent", MouseEvent));
afterEach(() => vi.unstubAllGlobals());

it("opens preferences by default and separates digest and account settings", () => {
  render(<NotificationsProfileSettings />);
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(
    screen.getByRole("tab", { name: "notification_preferences.tabs.preferences" }).getAttribute("aria-selected")
  ).toBe("true");
  expect(screen.queryByRole("heading", { name: "Digest settings" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Feishu binding status" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "notification_preferences.digest.title" }));
  expect(screen.getByRole("heading", { name: "Digest settings" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "choose workspace" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "notification_preferences.tabs.accounts" }));
  expect(screen.getByRole("heading", { name: "Feishu binding status" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Digest settings" })).toBeNull();
});

it("keeps the selected preferences scope when switching tabs", () => {
  render(<NotificationsProfileSettings />);
  fireEvent.click(screen.getByRole("button", { name: "choose workspace" }));
  fireEvent.click(screen.getByRole("tab", { name: "notification_preferences.digest.title" }));
  fireEvent.click(screen.getByRole("tab", { name: "notification_preferences.tabs.preferences" }));
  expect(screen.getByRole("button", { name: "workspace selected" })).toBeTruthy();
});
