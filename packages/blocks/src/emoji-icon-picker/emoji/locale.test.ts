import { expect, it } from "vitest";
import { getEmojiLocale } from "./locale";
it("maps app locales to the emoji dataset locales", () => {
  expect(getEmojiLocale("zh-CN")).toBe("zh");
  expect(getEmojiLocale("zh-TW")).toBe("zh-hant");
  expect(getEmojiLocale("ua")).toBe("uk");
  expect(getEmojiLocale("unknown")).toBe("en");
});
