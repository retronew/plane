import type { Locale } from "frimousse";

const locales: Record<string, Locale> = {
  "zh-CN": "zh",
  "zh-TW": "zh-hant",
  "pt-BR": "pt",
  "vi-VN": "vi",
  ua: "uk",
  en: "en",
  fr: "fr",
  es: "es",
  ja: "ja",
  ru: "ru",
  it: "it",
  de: "de",
  pl: "pl",
  ko: "ko",
  nl: "nl",
};
export const getEmojiLocale = (language: string): Locale => locales[language] ?? "en";

// Upstream zh messages contain traditional characters; keep the app's simplified labels consistent.
const simplifiedCategories: Record<string, string> = {
  笑脸: "表情与情绪",
  人体: "人物与身体",
  组件: "组件",
  野生动物: "动物与自然",
  食物飲料: "食物与饮品",
  食物饮料: "食物与饮品",
  旅遊地點: "旅行与地点",
  旅游地点: "旅行与地点",
  个人活动: "活动",
  物件: "物品",
  人的符号: "符号",
  旗帜: "旗帜",
};
export const getEmojiCategoryLabel = (label: string, language: string): string =>
  language === "zh-CN" ? (simplifiedCategories[label] ?? label) : label;
