/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportDownload } from "./presentation";
import { exportStatusLabel } from "./export-status";

vi.mock("@plane/i18n", () => ({
  translate: (key: string, params?: { format: string }) => (params ? `Download ${params.format}` : key),
}));

describe("Export history actions", () => {
  it.each([
    ["csv", "CSV"],
    ["xlsx", "Excel"],
    ["json", "JSON"],
  ])("labels the %s download and uses a single native link", (provider, format) => {
    render(<ExportDownload provider={provider} url="https://example.com/export" />);
    const link = screen.getByRole("link", { name: `Download ${format}` });
    expect(link.getAttribute("href")).toBe("https://example.com/export");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.querySelector("button")).toBeNull();
  });
  it("does not offer a download before the URL is ready", () => {
    render(<ExportDownload provider="csv" url="" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("localizes known statuses and preserves unknown server statuses", () => {
    expect(exportStatusLabel("processing")).toBe("workspace_settings.settings.exports.status_labels.processing");
    expect(exportStatusLabel("retrying")).toBe("retrying");
  });
});
