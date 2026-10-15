import { describe, expect, it } from "vitest";
import { truncateCategoryLabel } from "./layout";

describe("category axis labels", () => {
  it("preserves short labels and counts Chinese glyphs as wide", () => {
    expect(truncateCategoryLabel("未分配")).toBe("未分配");
    expect(truncateCategoryLabel("abcdefghijklmnopqrs")).toBe("abcdefghijklmnopqrs");
    expect(truncateCategoryLabel("这是一个非常长的中文模块名称")).toBe("这是一个非常长的中…");
  });
  it("keeps supplementary Unicode characters intact", () => {
    expect(truncateCategoryLabel("🚀🚀🚀", 4)).toBe("🚀🚀…");
  });
});
