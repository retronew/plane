/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { orderBy } from "lodash-es";
import { STATE_GROUPS } from "@plane/constants";
import type { IState } from "@plane/types";

export const sortStates = (states: IState[]) => {
  if (!states || states.length === 0) return;

  return orderBy(states, [(state) => Object.keys(STATE_GROUPS).indexOf(state.group), "sequence"]);
};
