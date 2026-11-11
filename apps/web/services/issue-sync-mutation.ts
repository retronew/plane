import { issueSync } from "@/lib/sync/issue-sync";

const listeners = new Set<() => void>();

/** Only mounted, fetched lists participate; historical caches are never visited. */
export function onIssueSyncMutation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function withIssueSyncMutation<T>(request: () => Promise<T>): Promise<T> {
  const resume = issueSync.pause();
  for (const listener of listeners) listener();
  try {
    return await request();
  } finally {
    // Service callers apply optimistic reconciliation in their promise continuations.
    // Resume on the next task, after those continuations have updated the stores.
    setTimeout(() => {
      issueSync.invalidate();
      resume();
    }, 0);
  }
}
