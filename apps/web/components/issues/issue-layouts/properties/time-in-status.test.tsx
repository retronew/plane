import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import type { TStateGroups } from "@plane/types";
import { TimeInStatusProperty } from "./time-in-status";
import { formatTimeInStatus } from "./status-duration";

const translation = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLocale: translation.locale }),
}));
const NOW = new Date("2026-10-28T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const props = { stateName: "Todo", stateGroup: "unstarted" as TStateGroups, chipClassName: "", isMobile: false };
beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  translation.locale = "en";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([
  [0, "<1 min", "<1分钟"],
  [30_000, "<1 min", "<1分钟"],
  [8_130_000, "2 hr", "2小时"],
  [45 * 60_000, "45 min", "45分钟"],
  [3 * 86_400_000, "3 days", "3天"],
  [29 * 86_400_000, "29 days", "29天"],
  [30 * 86_400_000, "1 mth", "1个月"],
  [70 * 86_400_000, "2 mths", "2个月"],
  [400 * 86_400_000, "1 yr", "1年"],
])("shows one whole localized unit for %d ms", (elapsed, en, zh) => {
  expect(formatTimeInStatus(new Date(ago(elapsed)), NOW, "en")).toBe(en);
  expect(formatTimeInStatus(new Date(ago(elapsed)), NOW, "zh-CN")).toBe(zh);
});
it("clamps future timestamps", () => {
  expect(formatTimeInStatus(new Date(NOW.getTime() + 60_000), NOW, "zh-CN")).toBe("<1分钟");
});
it.each([null, "invalid-timestamp"])("ignores an unavailable timestamp: %s", (timestamp) => {
  render(<TimeInStatusProperty {...props} issue={{ state_changed_at: timestamp, started_at: null }} />);
  expect(screen.queryByTestId("time-in-status")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["completed", "cancelled"] as const)("hides %s without subscribing to a clock", (stateGroup) => {
  render(
    <TimeInStatusProperty
      {...props}
      stateGroup={stateGroup}
      issue={{ state_changed_at: ago(3_600_000), started_at: null }}
    />
  );
  expect(screen.queryByTestId("time-in-status")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["2026-10-28T11:15:00Z", "2026-10-28T19:15:00+08:00"])(
  "preserves exact timestamp and timezone: %s",
  (timestamp) => {
    translation.locale = "zh-CN";
    render(<TimeInStatusProperty {...props} issue={{ state_changed_at: timestamp, started_at: null }} />);
    expect(screen.getByTestId("time-in-status").textContent).toBe("45分钟");
  }
);
it("wakes at the hour boundary, rather than once per second or minute", () => {
  const view = render(
    <TimeInStatusProperty {...props} issue={{ state_changed_at: ago(8_130_000), started_at: null }} />
  );
  const chip = screen.getByTestId("time-in-status");
  expect(chip.textContent).toBe("2 hr");
  act(() => vi.advanceTimersByTime(2_669_000));
  expect(chip.textContent).toBe("2 hr");
  act(() => vi.advanceTimersByTime(1_000));
  expect(chip.textContent).toBe("3 hr");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("updates minutes then switches to hours", () => {
  render(<TimeInStatusProperty {...props} issue={{ state_changed_at: ago(59 * 60_000), started_at: null }} />);
  expect(screen.getByTestId("time-in-status").textContent).toBe("59 min");
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByTestId("time-in-status").textContent).toBe("1 hr");
});
it("changes scale at the 30-day and 365-day boundaries", () => {
  const view = render(
    <TimeInStatusProperty {...props} issue={{ state_changed_at: ago(30 * 86_400_000 - 1_000), started_at: null }} />
  );
  expect(screen.getByTestId("time-in-status").textContent).toBe("29 days");
  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByTestId("time-in-status").textContent).toBe("1 mth");
  view.rerender(
    <TimeInStatusProperty
      {...props}
      issue={{ state_changed_at: new Date(Date.now() - 365 * 86_400_000 + 1_000).toISOString(), started_at: null }}
    />
  );
  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByTestId("time-in-status").textContent).toBe("1 yr");
});
it("resets on state changes and resumes after reopening", () => {
  const issue = observable({ state_changed_at: ago(3 * 86_400_000), started_at: null });
  const view = render(<TimeInStatusProperty {...props} issue={issue} />);
  expect(screen.getByTestId("time-in-status").textContent).toBe("3 days");
  act(() =>
    runInAction(() => {
      issue.state_changed_at = NOW.toISOString();
    })
  );
  expect(screen.getByTestId("time-in-status").textContent).toBe("<1 min");
  view.rerender(<TimeInStatusProperty {...props} stateGroup="completed" issue={issue} />);
  expect(screen.queryByTestId("time-in-status")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  view.rerender(<TimeInStatusProperty {...props} issue={issue} />);
  expect(screen.getByTestId("time-in-status").textContent).toBe("<1 min");
});
it("shares one timeout, pauses when hidden and catches up on return", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const issue = { state_changed_at: ago(45 * 60_000), started_at: null };
  render(
    <>
      <TimeInStatusProperty {...props} issue={issue} />
      <TimeInStatusProperty {...props} issue={issue} />
    </>
  );
  expect(vi.getTimerCount()).toBe(1);
  visibility.mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(120_000));
  visibility.mockReturnValue("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getAllByTestId("time-in-status").map((e) => e.textContent)).toEqual(["47 min", "47 min"]);
  expect(vi.getTimerCount()).toBe(1);
});
it("swallows clicks so the card does not open", () => {
  const onClick = vi.fn();
  render(
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div onClick={onClick}>
      <TimeInStatusProperty {...props} issue={{ state_changed_at: NOW.toISOString(), started_at: null }} />
    </div>
  );
  expect(fireEvent.click(screen.getByTestId("time-in-status"))).toBe(false);
  expect(onClick).not.toHaveBeenCalled();
});
