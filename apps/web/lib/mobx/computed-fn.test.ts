/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, autorun, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import { describe, expect, it } from "vitest";

// mobx-utils 6.1.1 predates MobX 7 and still declares mobx ^6 (pnpm-workspace.yaml accepts 7 for
// it). Stores lean on computedFn's memoization, so pin the behaviour they rely on.
class Store {
  items: Record<string, number> = { a: 1, b: 2 };
  calls = 0;

  constructor() {
    makeObservable(this, { items: observable, set: action });
  }

  set(key: string, value: number) {
    this.items[key] = value;
  }

  get = computedFn((key: string) => {
    this.calls++;
    return (this.items[key] ?? 0) * 10;
  });
}

describe("mobx-utils computedFn on the installed MobX", () => {
  it("does not memoize outside a reaction", () => {
    const store = new Store();
    expect([store.get("a"), store.get("a")]).toEqual([10, 10]);
    expect(store.calls).toBe(2);
  });

  it("memoizes per argument while observed and recomputes only what changed", () => {
    const store = new Store();
    const seen: number[] = [];
    const dispose = autorun(() => seen.push(store.get("a") + store.get("b")));
    expect(seen).toEqual([30]);
    expect(store.calls).toBe(2);

    store.get("a");
    expect(store.calls).toBe(2);

    store.set("a", 5);
    expect(seen).toEqual([30, 70]);
    expect(store.calls).toBe(3);

    store.set("c", 7);
    expect(seen).toEqual([30, 70]);
    expect(store.calls).toBe(3);

    runInAction(() => {
      store.set("a", 6);
      store.set("b", 6);
    });
    expect(seen).toEqual([30, 70, 120]);
    expect(store.calls).toBe(5);

    dispose();
    store.get("a");
    expect(store.calls).toBe(6);
  });
});
