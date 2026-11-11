import { SyncEngine } from "./engine";

// Construction is SSR-safe: the browser is accessed only when connecting.
export const issueSync = new SyncEngine((url) => new WebSocket(url));
