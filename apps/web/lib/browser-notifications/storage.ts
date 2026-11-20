// Shared by the page and the notification worker. No notification content is persisted.
const DATABASE = "plane-browser-notifications-v1";
const STORE = "state";

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.addEventListener("upgradeneeded", () => request.result.createObjectStore(STORE));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => reject(new Error("Notification storage blocked")));
  });
}

export async function readState<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(key);
      transaction.addEventListener("complete", () => resolve(request.result as T | undefined));
      transaction.addEventListener("error", () => reject(transaction.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function writeState<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, key);
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () => reject(transaction.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    database.close();
  }
}

export const preferenceKey = (userId: string) => `enabled:${userId}`;
export type BrowserPreference = { enabled: boolean; revision: string };
export async function getPreference(userId: string): Promise<BrowserPreference> {
  return (await readState<BrowserPreference>(preferenceKey(userId))) ?? { enabled: true, revision: "initial" };
}
export async function isEnabled(userId: string): Promise<boolean> {
  return (await getPreference(userId)).enabled;
}
