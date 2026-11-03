/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import { TimeInStatusProperty, formatTimeInStatus } from "./time-in-status";

const translation = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLocale: translation.locale }),
}));

const NOW = new Date("2026-10-28T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  translation.locale = "en";
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("formatTimeInStatus", () => {
  it.each([
    [0, "0 sec", "0秒"],
    [30_000, "30 sec", "30秒"],
    [8_130_000, "2 hr, 15 min, 30 sec", "2小时15分钟30秒"],
    [45 * 60_000, "45 min", "45分钟"],
    [7 * 3_600_000, "7 hr", "7小时"],
    [3 * 86_400_000, "3 days", "3天"],
    [15 * 86_400_000, "15 days", "15天"],
    [70 * 86_400_000, "2 mths, 9 days", "2个月9天"],
    [400 * 86_400_000, "1 yr, 1 mth, 5 days", "1年1个月5天"],
  ])("formats %d ms in the interface language", (elapsed, english, chinese) => {
    expect(formatTimeInStatus(ago(elapsed), NOW, "en")).toBe(english);
    expect(formatTimeInStatus(ago(elapsed), NOW, "zh-CN")).toBe(chinese);
  });

  it("never goes negative for a clock running behind the server", () => {
    expect(formatTimeInStatus(new Date(NOW.getTime() + 60_000), NOW, "zh-CN")).toBe("0秒");
  });
});

describe("TimeInStatusProperty", () => {
  it.each([null, "invalid-timestamp"])("renders nothing for an unavailable timestamp: %s", (timestamp) => {
    render(
      <TimeInStatusProperty
        issue={{ state_changed_at: timestamp, started_at: null }}
        stateName="Todo"
        chipClassName=""
        isMobile={false}
      />
    );
    expect(screen.queryByTestId("time-in-status")).toBeNull();
  });

  it("uses the current language for the displayed duration", () => {
    translation.locale = "zh-CN";
    render(
      <TimeInStatusProperty
        issue={{ state_changed_at: ago(3 * 86_400_000).toISOString(), started_at: null }}
        stateName="In Progress"
        chipClassName=""
        isMobile={false}
      />
    );
    expect(screen.getByTestId("time-in-status").textContent).toBe("3天");
  });

  it.each(["2026-10-28T11:15:00Z", "2026-10-28T19:15:00+08:00"])(
    "preserves the time and timezone of the server timestamp: %s",
    (timestamp) => {
      render(
        <TimeInStatusProperty
          issue={{ state_changed_at: timestamp, started_at: null }}
          stateName="Todo"
          chipClassName=""
          isMobile={false}
        />
      );
      expect(screen.getByTestId("time-in-status").textContent).toBe("45 min");
    }
  );

  it("advances elapsed time without another issue render and cleans up its timer", () => {
    const view = render(
      <TimeInStatusProperty
        issue={{ state_changed_at: ago(45 * 60_000).toISOString(), started_at: null }}
        stateName="Todo"
        chipClassName=""
        isMobile={false}
      />
    );
    expect(screen.getByTestId("time-in-status").textContent).toBe("45 min");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByTestId("time-in-status").textContent).toBe("45 min, 1 sec");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("immediately resets when the observable issue enters a different state", () => {
    const issue = observable({ state_changed_at: ago(3 * 86_400_000).toISOString(), started_at: null });
    render(<TimeInStatusProperty issue={issue} stateName="Todo" chipClassName="" isMobile={false} />);
    expect(screen.getByTestId("time-in-status").textContent).toBe("3 days");
    act(() =>
      runInAction(() => {
        issue.state_changed_at = NOW.toISOString();
      })
    );
    expect(screen.getByTestId("time-in-status").textContent).toBe("0 sec");
  });

  it("shares a single second timer across multiple task chips", () => {
    const issue = { state_changed_at: NOW.toISOString(), started_at: null };
    const first = render(<TimeInStatusProperty issue={issue} stateName="Todo" chipClassName="" isMobile={false} />);
    const second = render(<TimeInStatusProperty issue={issue} stateName="Todo" chipClassName="" isMobile={false} />);
    expect(vi.getTimerCount()).toBe(1);
    first.unmount();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByTestId("time-in-status").textContent).toBe("1 sec");
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("swallows clicks so the card under it does not open", () => {
    const onParentClick = vi.fn();
    render(
      // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
      <div onClick={onParentClick}>
        <TimeInStatusProperty
          issue={{ state_changed_at: NOW.toISOString(), started_at: null }}
          stateName="Todo"
          chipClassName=""
          isMobile={false}
        />
      </div>
    );
    const notPrevented = fireEvent.click(screen.getByTestId("time-in-status"));
    expect(notPrevented).toBe(false);
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
