/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { formatGanttMonth, formatGanttWeekday } from "./format-labels";

describe("Gantt calendar labels", () => {
  it("localizes month and weekday labels while retaining calendar boundaries", () => {
    expect(formatGanttMonth(2026, 0, "en")).toBe("Jan 2026");
    expect(formatGanttMonth(2026, 0, "zh-CN")).toBe("2026年1月");
    expect(formatGanttMonth(2026, 11, "zh-CN", false)).toBe("12月");
    expect(formatGanttWeekday(0, "en")).toBe("Sun");
    expect(formatGanttWeekday(0, "zh-CN")).toBe("周日");
    expect(formatGanttWeekday(6, "zh-CN")).toBe("周六");
  });
});
