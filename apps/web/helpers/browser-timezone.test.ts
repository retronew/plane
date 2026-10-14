import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserTimezone } from "./browser-timezone";
afterEach(() => vi.restoreAllMocks());
describe("browser time zone", () => {
  it("uses the browser's IANA time zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "Asia/Shanghai" }) }) as Intl.DateTimeFormat
    );
    expect(getBrowserTimezone()).toBe("Asia/Shanghai");
  });
  it("falls back safely when the browser cannot resolve a time zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(getBrowserTimezone()).toBe("UTC");
  });
});
