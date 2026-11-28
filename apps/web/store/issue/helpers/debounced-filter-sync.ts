/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TScheduledTasks = {
  fetchTimer: ReturnType<typeof setTimeout> | null;
  persistTimer: ReturnType<typeof setTimeout> | null;
  latestPersist: (() => Promise<unknown>) | null;
};

export type TDebouncedFilterSyncOptions = {
  fetchDelayMs?: number;
  persistDelayMs?: number;
};

export type TScheduleFilterSyncArgs = {
  fetch: () => unknown;
  persist?: () => Promise<unknown>;
  immediate?: boolean;
};

/**
 * Coalesces rapid multi-select filter changes per entity key so local MobX state updates
 * immediately while network fetches and user-property PATCHes fire once per burst.
 */
export function createDebouncedFilterSync(options: TDebouncedFilterSyncOptions = {}) {
  const { fetchDelayMs = 180, persistDelayMs = 450 } = options;
  const tasksByKey = new Map<string, TScheduledTasks>();

  const cancel = (key: string) => {
    const existing = tasksByKey.get(key);
    if (!existing) return;
    if (existing.fetchTimer) clearTimeout(existing.fetchTimer);
    if (existing.persistTimer) clearTimeout(existing.persistTimer);
    tasksByKey.delete(key);
  };

  const schedule = (key: string, { fetch, persist, immediate = false }: TScheduleFilterSyncArgs): Promise<void> => {
    const existing = tasksByKey.get(key) ?? {
      fetchTimer: null,
      persistTimer: null,
      latestPersist: null,
    };

    if (existing.fetchTimer) {
      clearTimeout(existing.fetchTimer);
      existing.fetchTimer = null;
    }
    if (existing.persistTimer) {
      clearTimeout(existing.persistTimer);
      existing.persistTimer = null;
    }

    if (immediate) {
      tasksByKey.delete(key);
      fetch();
      if (!persist) return Promise.resolve();
      return Promise.resolve(persist()).then(() => undefined);
    }

    existing.latestPersist = persist ?? null;
    existing.fetchTimer = setTimeout(() => {
      existing.fetchTimer = null;
      fetch();
      if (!existing.persistTimer) tasksByKey.delete(key);
    }, fetchDelayMs);

    tasksByKey.set(key, existing);

    if (!persist) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      existing.persistTimer = setTimeout(() => {
        existing.persistTimer = null;
        const persistFn = existing.latestPersist;
        existing.latestPersist = null;
        if (!existing.fetchTimer) tasksByKey.delete(key);
        if (!persistFn) {
          resolve();
          return;
        }
        Promise.resolve(persistFn())
          .then(() => resolve())
          .catch(reject);
      }, persistDelayMs);
    });
  };

  return { schedule, cancel };
}
