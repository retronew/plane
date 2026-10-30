import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TFileHandler } from "../types";

export function createEditorAssets(fileHandler: TFileHandler) {
  const urls = new Map<string, string>();
  const pending = new Map<string, Promise<string | undefined>>();
  const listeners = new Set<() => void>();
  let version = 0;
  let uploads = 0;
  let disposed = false;
  const notify = () => {
    version++;
    listeners.forEach((fn) => fn());
  };
  const load = (id: string) => {
    if (!id) return Promise.resolve(undefined);
    if (/^https?:\/\//i.test(id)) return Promise.resolve(id);
    if (urls.has(id)) return Promise.resolve(urls.get(id));
    if (pending.has(id)) return pending.get(id)!;
    const request = fileHandler
      .getAssetSrc(id)
      .then((url) => {
        if (!disposed && /^(https?:|blob:|\/)/i.test(url)) {
          urls.set(id, url);
          notify();
          return url;
        }
        return undefined;
      })
      .catch(() => undefined)
      .finally(() => pending.delete(id));
    pending.set(id, request);
    return request;
  };
  return {
    get fileHandler() {
      return fileHandler;
    },
    setFileHandler: (handler: TFileHandler) => {
      fileHandler = handler;
    },
    get: (id: string) => (/^https?:\/\//i.test(id) ? id : urls.get(id)),
    load,
    upload: async (blockId: string, file: File) => {
      if (!file.type.startsWith("image/") || file.size > fileHandler.validation.maxFileSize)
        throw new Error("Invalid image upload");
      uploads++;
      notify();
      try {
        const id = await fileHandler.upload(blockId, file);
        await load(id);
        return id;
      } finally {
        uploads--;
        notify();
      }
    },
    isUploading: () => uploads > 0,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => version,
    dispose: () => {
      disposed = true;
      listeners.clear();
      urls.clear();
    },
  };
}
export type EditorAssets = ReturnType<typeof createEditorAssets>;
export function useEditorAssets(fileHandler: TFileHandler) {
  // Keep the cache and imperative API stable when wrappers recreate their handlers.
  // State is local to this mounted editor; separate entities must never share it.
  const [assets] = useState(() => createEditorAssets(fileHandler));
  useLayoutEffect(() => {
    assets.setFileHandler(fileHandler);
  }, [assets, fileHandler]);
  const disposal = useRef(new Map<EditorAssets, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = disposal.current;
    clearTimeout(timers.get(assets));
    return () => {
      timers.set(
        assets,
        setTimeout(() => assets.dispose(), 0)
      );
    };
  }, [assets]);
  return assets;
}
export function useAssetUrl(assets: EditorAssets, id: string) {
  useSyncExternalStore(assets.subscribe, assets.snapshot, assets.snapshot);
  useEffect(() => {
    void assets.load(id);
  }, [assets, id]);
  return assets.get(id);
}
