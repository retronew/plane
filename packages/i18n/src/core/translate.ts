/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { i18nInstance } from "./instance";

/**
 * Non-hook translation for code that runs outside React components, such as route `meta`
 * functions that build the document title. Falls back to the key when the value is not a string.
 */
export const translate = (key: string, params?: Record<string, unknown>): string => {
  const value: unknown = params ? i18nInstance.t(key, params) : i18nInstance.t(key);
  return typeof value === "string" ? value : key;
};
