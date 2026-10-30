/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeInStatusProperty, formatTimeInStatus } from "./time-in-status";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const NOW = new Date("2026-10-28T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("formatTimeInStatus", () => {
  it.each([
    [30_000, "<1m"],
    [45 * 60_000, "45m"],
    [7 * 3_600_000, "7h"],
    [3 * 86_400_000, "3d"],
    [15 * 86_400_000, "2w"],
    [70 * 86_400_000, "2mo"],
    [400 * 86_400_000, "1y"],
  ])("formats %d ms as %s", (elapsed, expected) => {
    expect(formatTimeInStatus(ago(elapsed), NOW)).toBe(expected);
  });

  it("never goes negative for a clock running behind the server", () => {
    expect(formatTimeInStatus(new Date(NOW.getTime() + 60_000), NOW)).toBe("<1m");
  });
});

describe("TimeInStatusProperty", () => {
  afterEach(cleanup);

  it("renders nothing before the state entry time is known", () => {
    render(
      <TimeInStatusProperty
        issue={{ state_changed_at: null, started_at: null }}
        stateName="Todo"
        chipClassName=""
        isMobile={false}
      />
    );
    expect(screen.queryByTestId("time-in-status")).toBeNull();
  });

  it("shows how long the item has been in its state", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    try {
      render(
        <TimeInStatusProperty
          issue={{ state_changed_at: ago(3 * 86_400_000).toISOString(), started_at: null }}
          stateName="In Progress"
          chipClassName=""
          isMobile={false}
        />
      );
      expect(screen.getByTestId("time-in-status").textContent).toBe("3d");
    } finally {
      vi.useRealTimers();
    }
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
