/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { initPromise, i18nInstance } from "./instance";
import { LANGUAGE_STORAGE_KEY } from "../constants/language";
import type { TLanguage } from "../types";
import { detectBrowserLanguage } from "./detect-language";

export async function setLanguage(lng: TLanguage): Promise<void> {
  await initPromise;
  await i18nInstance.changeLanguage(lng);
  if (typeof window !== "undefined") {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    document.documentElement.lang = lng;
  }
}

/**
 * Forget any stored language choice and follow the browser language again (e.g. on sign-out).
 */
export async function resetLanguage(): Promise<void> {
  if (typeof window !== "undefined") localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  const lng = detectBrowserLanguage();
  await initPromise;
  await i18nInstance.changeLanguage(lng);
  if (typeof window !== "undefined") document.documentElement.lang = lng;
}
