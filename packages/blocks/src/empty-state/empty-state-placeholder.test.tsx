/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyStateCompact } from "./compact-empty-state";
import { EmptyStateDetailed } from "./detailed-empty-state";
import { getCompactAssetDimensions, getDetailedAssetDimensions } from "./assets/asset-registry";

describe("EmptyState illustration placeholder reservation", () => {
  it("reserves exact dimensions for EmptyStateDetailed while the lazy illustration chunk loads", () => {
    const { container } = render(
      <EmptyStateDetailed assetKey="cycle" title="No cycles yet" description="Create a cycle to begin." />
    );

    const expected = getDetailedAssetDimensions("cycle");
    expect(expected).toEqual({ width: 160, height: 165 });

    const placeholder = container.querySelector<HTMLElement>("[data-empty-state-placeholder]");
    // Either the lazy chunk is still suspended (placeholder reserves exact box) or already cached (container keeps minHeight).
    if (placeholder) {
      expect(placeholder.style.width).toBe("160px");
      expect(placeholder.style.height).toBe("165px");
      expect(placeholder.getAttribute("aria-hidden")).toBe("true");
    }
    const wrapper = container.querySelector<HTMLElement>("[style*='min-height']");
    expect(wrapper?.style.minHeight).toBe("165px");
  });

  it("reserves exact dimensions for EmptyStateCompact while the lazy illustration chunk loads", () => {
    const { container } = render(<EmptyStateCompact assetKey="members" title="No assignee" />);

    const expected = getCompactAssetDimensions("members");
    expect(expected).toEqual({ width: 71, height: 80 });

    const wrapper = container.querySelector<HTMLElement>("[style*='min-height']");
    expect(wrapper?.style.minHeight).toBe("80px");
  });
});
