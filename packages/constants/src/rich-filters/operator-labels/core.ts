/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCoreSupportedOperators, TCoreSupportedDateFilterOperators } from "@plane/types";
import { CORE_EQUALITY_OPERATOR, CORE_COLLECTION_OPERATOR, CORE_COMPARISON_OPERATOR } from "@plane/types";

/**
 * Core operator labels
 */
export const CORE_OPERATOR_LABELS_MAP: Record<TCoreSupportedOperators, string> = {
  [CORE_COMPARISON_OPERATOR.CONTAINS]: "common.filter_operators.contains",
  [CORE_EQUALITY_OPERATOR.EXACT]: "common.filter_operators.exact",
  [CORE_COLLECTION_OPERATOR.IN]: "common.filter_operators.in",
  [CORE_COMPARISON_OPERATOR.RANGE]: "common.filter_operators.range",
} as const;

/**
 * Core date-specific operator labels
 */
export const CORE_DATE_OPERATOR_LABELS_MAP: Record<TCoreSupportedDateFilterOperators, string> = {
  [CORE_EQUALITY_OPERATOR.EXACT]: "common.filter_operators.exact",
  [CORE_COMPARISON_OPERATOR.RANGE]: "common.filter_operators.range",
} as const;
