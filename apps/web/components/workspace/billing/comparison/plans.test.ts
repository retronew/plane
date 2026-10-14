/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@plane/i18n";
import { PLANE_PLANS, PLANS_COMPARISON_LIST } from "./plans";

describe("billing comparison localization", () => {
  afterEach(async () => {
    await setLanguage("en");
  });
  it("reads descriptions, limits and highlights in the current language without changing plan capabilities", async () => {
    const projects = PLANS_COMPARISON_LIST[0].features[0];
    await setLanguage("zh-CN");
    expect(projects.title).toBe("项目");
    expect(projects.description).toBe("创建项目来管理工作项、周期和模块。");
    expect(projects.cloud.free).toBe(true);
    expect(PLANE_PLANS.planHighlights.free[0]).toBe("最多 12 位用户");
    await setLanguage("en");
    expect(projects.title).toBe("Projects");
    expect(PLANE_PLANS.planHighlights.free[0]).toBe("Upto 12 users");
    expect(projects.cloud.free).toBe(true);
  });
});
