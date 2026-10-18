/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";

const TIMER = 30;

/** Counts down once per second from `initialValue`; callers can also set the value directly. */
export const useTimer = (initialValue: number = TIMER) => {
  const [timer, setTimer] = useState(initialValue);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { timer, setTimer };
};
