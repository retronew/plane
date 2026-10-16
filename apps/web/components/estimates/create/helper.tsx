/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ESTIMATE_SYSTEMS } from "@plane/constants";
import type { IEstimate, TEstimateSystemKeys } from "@plane/types";
import { EEstimateSystem } from "@plane/types";

export const isEstimateSystemEnabled = (key: TEstimateSystemKeys) => {
  switch (key) {
    case EEstimateSystem.POINTS:
      return true;
    case EEstimateSystem.CATEGORIES:
      return true;
    default:
      return false;
  }
};

/** Translate built-in names at render time, retaining names supplied by users. */
export function getEstimateDisplayName(estimate: Pick<IEstimate, "name" | "type">, t: (key: string) => string) {
  const system = estimate.type ? ESTIMATE_SYSTEMS[estimate.type] : undefined;
  return system && estimate.name === system.name ? t(system.i18n_name) : estimate.name;
}
