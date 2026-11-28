/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import useFontFaceObserver from "use-font-face-observer";

const MATERIAL_SYMBOLS_FONT_FACES = [
  {
    family: "Material Symbols Rounded",
    style: "normal",
    weight: "normal",
    stretch: "condensed",
  },
];

let materialSymbolsFontReady = false;

function isDocumentMaterialFontReady(): boolean {
  if (materialSymbolsFontReady) return true;
  if (typeof document === "undefined" || !("fonts" in document) || typeof document.fonts?.check !== "function") {
    return false;
  }
  try {
    if (document.fonts.check('16px "Material Symbols Rounded"')) {
      materialSymbolsFontReady = true;
      return true;
    }
  } catch {
    // Ignore unsupported document.fonts.check implementations in test runtimes.
  }
  return false;
}

export function useMaterialSymbolsFontLoaded(): boolean {
  const observed = useFontFaceObserver(MATERIAL_SYMBOLS_FONT_FACES);

  useEffect(() => {
    if (observed) {
      materialSymbolsFontReady = true;
    }
  }, [observed]);

  return observed || isDocumentMaterialFontReady();
}

/** @internal Exposed for unit tests only. */
export function resetMaterialSymbolsFontCacheForTests() {
  materialSymbolsFontReady = false;
}
