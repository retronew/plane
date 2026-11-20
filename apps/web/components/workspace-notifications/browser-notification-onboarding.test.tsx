import { StrictMode } from "react";
import { observable, runInAction } from "mobx";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserNotificationOnboarding } from "./browser-notification-onboarding";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn<() => { id: string } | null>(),
  supported: vi.fn(),
  isEnabled: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
  requestPermission: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: mocks.getUser() }) }));
vi.mock("@/lib/browser-notifications/client", () => ({
  NOTIFICATION_PREFERENCE_EVENT: "notification-onboarding-test",
  supportsBrowserNotifications: mocks.supported,
}));
vi.mock("@/lib/browser-notifications/storage", () => ({
  isEnabled: mocks.isEnabled,
  readState: mocks.readState,
  writeState: mocks.writeState,
}));

const title = "notification_preferences.browser.onboarding.title";
const later = "notification_preferences.browser.onboarding.later";
const allow = "notification_preferences.browser.allow";
const native = { permission: "default" as NotificationPermission, requestPermission: mocks.requestPermission };
const user = observable.box<{ id: string } | null>(null);
const setUser = (id: string | null) => runInAction(() => user.set(id ? { id } : null));

beforeEach(() => {
  vi.clearAllMocks();
  setUser("first");
  mocks.getUser.mockImplementation(() => user.get());
  mocks.supported.mockReturnValue(true);
  mocks.isEnabled.mockResolvedValue(true);
  mocks.requestPermission.mockResolvedValue("granted");
  native.permission = "default";
  vi.stubGlobal("Notification", native);
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("PointerEvent", MouseEvent);
  const state = new Map<string, boolean>();
  mocks.readState.mockImplementation(async (key: string) => state.get(key));
  mocks.writeState.mockImplementation(async (key: string, value: boolean) => void state.set(key, value));
  // Model the serial Web Locks contract while exercising the real claim and dialog code.
  let lock = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, run: () => Promise<boolean>) => {
        const result = lock.then(run);
        lock = result.then(
          () => undefined,
          () => undefined
        );
        return result;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "locks");
  Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const dialog = () => screen.findByRole("dialog", { name: title });
const expectClosed = () => waitFor(() => expect(screen.queryByRole("dialog", { name: title })).toBeNull());

it("shows one prompt across simultaneous mounts and does not show it again after a reload", async () => {
  const first = render(
    <StrictMode>
      <BrowserNotificationOnboarding />
      <BrowserNotificationOnboarding />
    </StrictMode>
  );
  await dialog();
  await waitFor(() => expect(mocks.writeState).toHaveBeenCalledExactlyOnceWith("onboarding-presented:first", true));
  expect(mocks.requestPermission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: later }));
  await expectClosed();
  expect(mocks.requestPermission).not.toHaveBeenCalled();
  expect(mocks.writeState).toHaveBeenCalledTimes(1);

  first.unmount();
  await act(async () => void render(<BrowserNotificationOnboarding />));
  expect(screen.queryByRole("dialog", { name: title })).toBeNull();
});

function holdOpeningAnimation() {
  let finishOpening!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishOpening = resolve;
  });
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value(this: HTMLElement) {
      return this.hasAttribute("data-open") ? [{ finished }] : [];
    },
  });
  return finishOpening;
}

it("lets another tab open the prompt if the first one disappears before the opening animation finishes", async () => {
  const finishOpening = holdOpeningAnimation();
  const first = render(<BrowserNotificationOnboarding />);
  const popup = await dialog();
  expect(mocks.writeState).not.toHaveBeenCalled();

  await act(async () => void render(<BrowserNotificationOnboarding />));
  expect(screen.getAllByRole("dialog", { name: title })).toEqual([popup]);
  first.unmount();
  expect(await dialog()).not.toBe(popup);
  expect(mocks.writeState).not.toHaveBeenCalled();

  await act(async () => finishOpening());
  await waitFor(() => expect(mocks.writeState).toHaveBeenCalledTimes(1));
});

it.each(["visibilitychange", "pagehide"] as const)("retries an unconfirmed opening after %s", async (event) => {
  const finishOpening = holdOpeningAnimation();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  render(<BrowserNotificationOnboarding />);
  await dialog();

  if (event === "visibilitychange") {
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event(event));
  } else fireEvent(window, new Event(event));
  await expectClosed();
  expect(mocks.writeState).not.toHaveBeenCalled();

  visibility.mockReturnValue("visible");
  if (event === "visibilitychange") fireEvent(document, new Event(event));
  else fireEvent(window, new Event("pageshow"));
  await dialog();
  await act(async () => finishOpening());
  await waitFor(() => expect(mocks.writeState).toHaveBeenCalledTimes(1));
});

it("does not count an opening if permission changes in another tab before presentation", async () => {
  const finishOpening = holdOpeningAnimation();
  render(<BrowserNotificationOnboarding />);
  await dialog();
  native.permission = "granted";
  await act(async () => finishOpening());
  await expectClosed();
  expect(mocks.writeState).not.toHaveBeenCalled();
});

it.each(["granted", "denied", "default"] as const)(
  "only requests permission on Allow and closes on %s",
  async (result) => {
    mocks.requestPermission.mockResolvedValueOnce(result);
    render(<BrowserNotificationOnboarding />);
    await dialog();
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    const changed = vi.fn();
    window.addEventListener("notification-onboarding-test", changed, { once: true });
    fireEvent.click(screen.getByRole("button", { name: allow }));
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
    await expectClosed();
    expect(changed).toHaveBeenCalledTimes(1);
  }
);

it.each(["granted", "denied", "unsupported", "disabled", "signed-out"] as const)(
  "does not prompt when %s",
  async (state) => {
    if (state === "granted" || state === "denied") native.permission = state;
    if (state === "unsupported") mocks.supported.mockReturnValue(false);
    if (state === "disabled") mocks.isEnabled.mockResolvedValue(false);
    if (state === "signed-out") setUser(null);
    await act(async () => void render(<BrowserNotificationOnboarding />));
    expect(screen.queryByRole("dialog", { name: title })).toBeNull();
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(mocks.writeState).not.toHaveBeenCalled();
  }
);

it("does not suppress the prompt using a legacy marker written before rendering", async () => {
  mocks.readState.mockImplementation(async (key: string) => (key === "onboarding-shown:first" ? true : undefined));
  render(<BrowserNotificationOnboarding />);
  await dialog();
  await waitFor(() => expect(mocks.writeState).toHaveBeenCalledExactlyOnceWith("onboarding-presented:first", true));
});

it("waits until a background tab becomes visible rather than consuming its prompt early", async () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => void render(<BrowserNotificationOnboarding />));
  expect(mocks.readState).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  await dialog();
});

it("ignores backdrop clicks but still dismisses from the Later button", async () => {
  render(<BrowserNotificationOnboarding />);
  const popup = await dialog();
  const backdrop = document.querySelector(".bg-backdrop[data-open]");
  if (!backdrop) throw new Error("Expected the open dialog's backdrop");
  fireEvent.pointerDown(backdrop, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(backdrop, { button: 0 });
  fireEvent.pointerUp(backdrop, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(backdrop, { button: 0 });
  fireEvent.click(backdrop, { button: 0 });
  expect(screen.getByRole("dialog", { name: title })).toBe(popup);
  expect(mocks.requestPermission).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: later }));
  await expectClosed();
});

it("supports dismissal via Escape and keeps the shown marker separate by account", async () => {
  render(<BrowserNotificationOnboarding />);
  fireEvent.keyDown(await dialog(), { key: "Escape" });
  await expectClosed();
  expect(mocks.requestPermission).not.toHaveBeenCalled();
  act(() => setUser("second"));
  await dialog();
  await waitFor(() => expect(mocks.writeState).toHaveBeenLastCalledWith("onboarding-presented:second", true));
});

it("leaves the page usable when the presentation marker cannot be read", async () => {
  const error = new Error("blocked");
  mocks.readState.mockRejectedValueOnce(error);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await act(async () => void render(<BrowserNotificationOnboarding />));
  expect(warning).toHaveBeenCalledExactlyOnceWith("Browser notification onboarding unavailable", error);
  expect(screen.queryByRole("dialog", { name: title })).toBeNull();
  expect(mocks.requestPermission).not.toHaveBeenCalled();
});

it("shows an accessible error and allows retry if the native permission request throws", async () => {
  mocks.requestPermission.mockRejectedValueOnce(new Error("unavailable"));
  render(<BrowserNotificationOnboarding />);
  await dialog();
  fireEvent.click(screen.getByRole("button", { name: allow }));
  expect((await screen.findByRole("alert")).textContent).toBe("notification_preferences.browser.error");
  fireEvent.click(screen.getByRole("button", { name: allow }));
  await expectClosed();
  expect(mocks.requestPermission).toHaveBeenCalledTimes(2);
});
