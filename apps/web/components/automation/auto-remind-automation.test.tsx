import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AutoRemindAutomation } from "./auto-remind-automation";
const state = vi.hoisted(() => ({ project: { remind_in: 0 }, editable: true }));
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ currentProjectDetails: state.project }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.editable }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string, args?: { count: number }) => (args ? `${args.count} days` : key) }),
}));
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  state.project.remind_in = 0;
  state.editable = true;
});
it("defaults off and enables a one-day reminder through the settings API callback", () => {
  const change = vi.fn().mockResolvedValue({});
  const { container } = render(<AutoRemindAutomation handleChange={change} />);
  expect(container.querySelector("[data-automation-panel]")?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(screen.getByRole("switch", { name: "project_settings.automations.auto-remind.title" }));
  expect(change).toHaveBeenCalledWith({ remind_in: 1 });
});
it("offers exactly one to seven days, persists selection, and can be disabled", async () => {
  state.project.remind_in = 1;
  const change = vi.fn().mockResolvedValue({});
  const { container, rerender } = render(<AutoRemindAutomation handleChange={change} />);
  fireEvent.click(screen.getByText("1 days").closest("button")!);
  const options = await screen.findAllByRole("option");
  expect(options).toHaveLength(7);
  const seven = screen.getByRole("option", { name: "7 days" });
  fireEvent.pointerDown(seven, { pointerType: "mouse", button: 0 });
  fireEvent.click(seven);
  await waitFor(() => expect(change).toHaveBeenCalledWith({ remind_in: 7 }));
  fireEvent.click(screen.getByRole("switch", { name: "project_settings.automations.auto-remind.title" }));
  expect(change).toHaveBeenCalledWith({ remind_in: 0 });
  state.project.remind_in = 0;
  rerender(<AutoRemindAutomation handleChange={(data) => change(data)} />);
  expect(container.querySelector("[data-automation-panel]")?.hasAttribute("inert")).toBe(true);
});
it("hides expanded controls when off and prevents changes without permissions", () => {
  state.editable = false;
  const change = vi.fn().mockResolvedValue(undefined);
  render(<AutoRemindAutomation handleChange={change} />);
  expect(
    screen.getByRole("switch", { name: "project_settings.automations.auto-remind.title" }).getAttribute("aria-disabled")
  ).toBe("true");
  fireEvent.click(screen.getByRole("switch", { name: "project_settings.automations.auto-remind.title" }));
  expect(change).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllGlobals());
it("lets email be disabled independently and exposes no in-app opt-out", () => {
  state.project.remind_in = 1;
  const change = vi.fn().mockResolvedValue(undefined);
  render(<AutoRemindAutomation handleChange={change} />);
  fireEvent.click(screen.getByRole("switch", { name: "project_settings.automations.auto-remind.email_label" }));
  expect(change).toHaveBeenCalledWith({ remind_email_enabled: false });
  fireEvent.click(screen.getByRole("switch", { name: "notification_preferences.project_feishu_reminder" }));
  expect(change).toHaveBeenCalledWith({ remind_feishu_enabled: false });
  expect(screen.getByText("notification_preferences.project_reminder_hint")).toBeTruthy();
  expect(screen.getAllByRole("switch")).toHaveLength(3);
});
