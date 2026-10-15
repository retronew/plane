import { waitFor } from "@testing-library/react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { afterEach, expect, it, vi } from "vitest";
import type { TInsightTableFeatures } from "./insight-table/table-features";
import { exportAnalytics, getExportRows } from "./export";
const csv = vi.hoisted(() => ({ generate: vi.fn(() => "csv"), download: vi.fn() }));
vi.mock("export-to-csv", () => ({
  mkConfig: (config: unknown) => config,
  generateCsv: () => csv.generate,
  download: () => csv.download,
}));
type Entry = { name: string; count: number; internal: string };
const rows = [{ original: { name: "=1+1", count: 0, internal: "hidden" } }] as Row<TInsightTableFeatures, Entry>[];
const columns: ColumnDef<TInsightTableFeatures, Entry>[] = [
  { accessorKey: "name", meta: { export: { key: "name", label: "名称", value: (row) => row.original.name } } },
  { accessorKey: "count", meta: { export: { key: "count", label: "数量", value: (row) => row.original.count } } },
  { accessorKey: "internal" },
];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("exports declared columns in order with localized headers and retains numeric zero", () => {
  expect(getExportRows(rows, columns)).toEqual([{ 名称: "=1+1", 数量: 0 }]);
  expect(getExportRows([], columns)).toEqual([]);
});
it("escapes spreadsheet formula text for CSV without modifying numeric values", () => {
  exportAnalytics(rows, columns, "workspace", "csv");
  expect(csv.generate).toHaveBeenCalledWith([{ 名称: "'=1+1", 数量: 0 }]);
  expect(csv.download).toHaveBeenCalledWith("csv");
});
it("downloads real JSON with original text and cleans up the object URL", async () => {
  const create = vi.fn((_blob: Blob) => "blob:test");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  exportAnalytics(rows, columns, "workspace", "json");
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toBe("workspace-analytics.json");
  expect(link.isConnected).toBe(false);
  const blob: Blob = create.mock.calls[0][0];
  expect(blob.type).toBe("application/json;charset=utf-8");
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.readAsText(blob);
  });
  expect(JSON.parse(text)).toEqual([{ 名称: "=1+1", 数量: 0 }]);
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:test"));
});
