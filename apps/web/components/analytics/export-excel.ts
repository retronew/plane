import writeExcelFile from "write-excel-file/browser";
import type { SheetData } from "write-excel-file/browser";

type ExportRow = Record<string, string | number>;

export function getAnalyticsExcelData(rows: ExportRow[]): SheetData {
  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.map((value) => ({ value, type: String, fontWeight: "bold", backgroundColor: "#F4F5F7", height: 24 })),
    ...rows.map((row) =>
      headers.map((key) => ({
        value: row[key],
        type: typeof row[key] === "number" ? Number : String,
        wrap: true,
        alignVertical: "top" as const,
      }))
    ),
  ];
}

const textWidth = (value: string | number) =>
  [...String(value)].reduce((width, char) => width + (char.codePointAt(0)! > 255 ? 2 : 1), 0);

export async function createAnalyticsExcel(rows: ExportRow[]): Promise<Blob> {
  const headers = Object.keys(rows[0] ?? {});
  return writeExcelFile(getAnalyticsExcelData(rows), {
    sheet: "Analytics",
    stickyRowsCount: 1,
    columns: headers.map((key) => ({
      width: Math.min(
        60,
        rows.reduce((width, row) => Math.max(width, textWidth(row[key])), Math.max(12, textWidth(key))) + 2
      ),
    })),
  }).toBlob();
}
