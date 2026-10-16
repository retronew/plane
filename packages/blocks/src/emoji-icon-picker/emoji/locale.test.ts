import { expect, it } from "vitest";
import { getEmojiLocale } from "./locale";
it("maps app locales to the emoji dataset locales", () => {
  expect(getEmojiLocale("zh-CN")).toBe("zh");
  expect(getEmojiLocale("zh-TW")).toBe("zh-hant");
  expect(getEmojiLocale("ua")).toBe("uk");
  expect(getEmojiLocale("unknown")).toBe("en");
});

import { getEmojiCategoryLabel } from "./locale";
it("uses simplified category labels only for simplified Chinese", () => {
  expect(getEmojiCategoryLabel("食物飲料", "zh-CN")).toBe("食物与饮品");
  expect(getEmojiCategoryLabel("旅遊地點", "zh-CN")).toBe("旅行与地点");
  expect(getEmojiCategoryLabel("食物飲料", "zh-TW")).toBe("食物飲料");
  expect(getEmojiCategoryLabel("Unknown", "en")).toBe("Unknown");
});
