/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "../constants/language";
import type { TLanguage } from "../types";

// browser language codes that don't map onto a supported language by prefix alone
const LANGUAGE_ALIASES: Record<string, TLanguage> = {
  zh: "zh-CN",
  "zh-hans": "zh-CN",
  "zh-sg": "zh-CN",
  "zh-hant": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
  pt: "pt-BR",
  uk: "ua",
  ka: "ka-ge",
  vi: "vi-VN",
  tr: "tr-TR",
};

/**
 * Map a BCP 47 language tag (e.g. "zh-Hans-CN", "fr-FR") to a supported language, if any.
 */
export const matchSupportedLanguage = (tag: string): TLanguage | undefined => {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return undefined;
  const exact = SUPPORTED_LANGUAGES.find((l) => l.value.toLowerCase() === normalized);
  if (exact) return exact.value;
  // try progressively shorter prefixes: "zh-hant-tw" -> "zh-hant" -> "zh"
  const parts = normalized.split("-");
  for (let i = parts.length; i > 0; i--) {
    const prefix = parts.slice(0, i).join("-");
    if (LANGUAGE_ALIASES[prefix]) return LANGUAGE_ALIASES[prefix];
    const supported = SUPPORTED_LANGUAGES.find((l) => l.value.toLowerCase() === prefix);
    if (supported) return supported.value;
  }
  return undefined;
};

/**
 * Pick the first browser-preferred language that Plane supports, falling back to English.
 */
export const detectBrowserLanguage = (): TLanguage => {
  if (typeof navigator === "undefined") return FALLBACK_LANGUAGE;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    const match = tag ? matchSupportedLanguage(tag) : undefined;
    if (match) return match;
  }
  return FALLBACK_LANGUAGE;
};
