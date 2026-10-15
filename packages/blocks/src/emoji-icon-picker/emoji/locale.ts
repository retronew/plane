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
