/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { i18nInstance, initPromise } from "./instance";

// Runs under plain Node (vitest externalizes node_modules), the same way SSR loads
// i18next-icu. If intl-messageformat's default import resolves to a CJS module object,
// i18next-icu swallows the error and returns the raw ICU message instead.
describe("i18n instance under Node", () => {
  it("interpolates ICU arguments", async () => {
    await initPromise;
    expect(i18nInstance.t("common.no_of", { entity: "X" })).toBe("No. of X");
  });

  it("formats ICU plurals", async () => {
    await initPromise;
    expect(i18nInstance.t("subscriber", { count: 1 })).toBe("1 Subscriber");
    expect(i18nInstance.t("subscriber", { count: 3 })).toBe("3 Subscribers");
  });
});
