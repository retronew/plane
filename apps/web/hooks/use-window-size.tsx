/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSyncExternalStore } from "react";

const serverSize = [0, 0];
let cachedSize = serverSize;

const getSnapshot = () => {
  if (cachedSize[0] !== window.innerWidth || cachedSize[1] !== window.innerHeight) {
    cachedSize = [window.innerWidth, window.innerHeight];
  }
  return cachedSize;
};

const getServerSnapshot = () => serverSize;
const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

const useSize = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useSize;
