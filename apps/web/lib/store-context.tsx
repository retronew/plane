/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactElement } from "react";
import { createContext } from "react";
// plane web store
import { RootStore } from "@/store/root.store";

// react-doctor-disable-next-line react-doctor/only-export-components -- store/context module: the store, its context and the provider live together by design
export let rootStore = new RootStore();

// react-doctor-disable-next-line react-doctor/only-export-components -- store/context module: the store, its context and the provider live together by design
export const StoreContext = createContext<RootStore>(rootStore);

const initializeStore = () => {
  const newRootStore = rootStore ?? new RootStore();
  if (typeof window === "undefined") return newRootStore;
  if (!rootStore) rootStore = newRootStore;
  return newRootStore;
};

// react-doctor-disable-next-line react-doctor/only-export-components -- store/context module: the store, its context and the provider live together by design
export const store = initializeStore();

export function StoreProvider({ children }: { children: ReactElement }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
