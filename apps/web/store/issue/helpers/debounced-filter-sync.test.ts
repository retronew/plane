/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedFilterSync } from "./debounced-filter-sync";

describe("createDebouncedFilterSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid filter updates into a single fetch and persist", async () => {
    const sync = createDebouncedFilterSync({ fetchDelayMs: 180, persistDelayMs: 450 });
    const fetch1 = vi.fn();
    const fetch2 = vi.fn();
    const fetch3 = vi.fn();
    const persist1 = vi.fn(async () => {});
    const persist2 = vi.fn(async () => {});
    const persist3 = vi.fn(async () => {});

    void sync.schedule("proj-1", { fetch: fetch1, persist: persist1 });
    vi.advanceTimersByTime(60);
    void sync.schedule("proj-1", { fetch: fetch2, persist: persist2 });
    vi.advanceTimersByTime(60);
    const lastPromise = sync.schedule("proj-1", { fetch: fetch3, persist: persist3 });

    vi.advanceTimersByTime(180);
    expect(fetch1).not.toHaveBeenCalled();
    expect(fetch2).not.toHaveBeenCalled();
    expect(fetch3).toHaveBeenCalledOnce();
    expect(persist3).not.toHaveBeenCalled();

    vi.advanceTimersByTime(270);
    await lastPromise;
    expect(persist1).not.toHaveBeenCalled();
    expect(persist2).not.toHaveBeenCalled();
    expect(persist3).toHaveBeenCalledOnce();
  });

  it("executes immediately when immediate flag is true and cancels pending timers", async () => {
    const sync = createDebouncedFilterSync({ fetchDelayMs: 180, persistDelayMs: 450 });
    const staleFetch = vi.fn();
    const stalePersist = vi.fn(async () => {});
    const clearFetch = vi.fn();
    const clearPersist = vi.fn(async () => {});

    void sync.schedule("proj-1", { fetch: staleFetch, persist: stalePersist });
    await sync.schedule("proj-1", { fetch: clearFetch, persist: clearPersist, immediate: true });

    vi.advanceTimersByTime(1000);
    expect(staleFetch).not.toHaveBeenCalled();
    expect(stalePersist).not.toHaveBeenCalled();
    expect(clearFetch).toHaveBeenCalledOnce();
    expect(clearPersist).toHaveBeenCalledOnce();
  });
});
