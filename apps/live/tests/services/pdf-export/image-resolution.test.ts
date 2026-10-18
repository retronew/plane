/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { PdfExportService } from "@/services/pdf-export/pdf-export.service";
import type { getPageService } from "@/services/page/handler";

describe("PDF image URL resolution", () => {
  it("resolves every asset with at most four concurrent requests", async () => {
    let active = 0;
    let maximum = 0;
    const resolveImageAssetUrl = vi.fn(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return null;
    });
    const pageService = { resolveImageAssetUrl } as unknown as ReturnType<typeof getPageService>;
    const assetIds = Array.from({ length: 9 }, (_, index) => `asset-${index}`);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PdfExportService;
        return yield* service.processImages(pageService, "workspace", "project", assetIds, "request");
      }).pipe(Effect.provide(PdfExportService.Default))
    );

    expect(result).toEqual({});
    expect(resolveImageAssetUrl).toHaveBeenCalledTimes(assetIds.length);
    expect(maximum).toBe(4);
    for (const assetId of assetIds) {
      expect(resolveImageAssetUrl).toHaveBeenCalledWith("workspace", assetId, "project");
    }
  });
});
