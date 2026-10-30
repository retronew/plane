import { useEffect, useMemo } from "react";
import type { TFileHandler } from "@plane/editor";
import { COMPARISON_IMAGE } from "./sample";

export const SANDBOX_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

type SandboxAsset = { file?: File; url: string; deleted: boolean };

export type SandboxRemoteAssets = {
  upload: (file: File) => Promise<string>;
  get: (id: string) => string | undefined;
};

/** Local or room-scoped development assets; no production asset endpoints are used. */
export function createSandboxAssets(remote?: SandboxRemoteAssets) {
  const entries = new Map<string, SandboxAsset>();
  // The bundled URL owns no browser resource. Keep it available through StrictMode
  // effect cleanup/replay and sample resets, without allocating during render.
  const demo: SandboxAsset = { url: COMPARISON_IMAGE.url, deleted: false };
  const findAsset = (id: string): SandboxAsset | undefined => {
    if (id === COMPARISON_IMAGE.id) return demo;
    const existing = entries.get(id);
    if (existing) return existing;
    const url = remote?.get(id);
    if (!url) return undefined;
    const asset = { url, deleted: false };
    entries.set(id, asset);
    return asset;
  };
  const assetsUploadStatus: Record<string, number> = {};
  const requireAsset = (id: string) => {
    const asset = findAsset(id);
    if (!asset) throw new Error("Image is unavailable in this comparison session");
    return asset;
  };
  const upload = async (blockId: string, file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Select an image file");
    if (file.size > SANDBOX_IMAGE_MAX_SIZE) throw new Error("Images must be 5 MB or smaller");
    const id = remote ? await remote.upload(file) : crypto.randomUUID();
    if (remote) {
      const url = remote.get(id);
      if (!url) throw new Error("Uploaded image is unavailable");
      entries.set(id, { url, deleted: false });
    } else {
      entries.set(id, { file, url: URL.createObjectURL(file), deleted: false });
    }
    assetsUploadStatus[blockId] = 100;
    return id;
  };
  const fileHandler: TFileHandler = {
    showImageDeleteAction: true,
    assetsUploadStatus,
    cancel: () => {},
    checkIfAssetExists: async (id) => Boolean(findAsset(id)),
    // Deletion is deliberately soft: the other editor and undo history still own references.
    delete: async (id) => {
      requireAsset(id).deleted = true;
    },
    restore: async (id) => {
      requireAsset(id).deleted = false;
    },
    getAssetSrc: async (id) => requireAsset(id).url,
    getAssetDownloadSrc: async (id) => requireAsset(id).url,
    upload,
    duplicate: async (id) => {
      const asset = requireAsset(id);
      if (remote) return id;
      if (asset.file) return upload(crypto.randomUUID(), asset.file);
      const copyId = crypto.randomUUID();
      entries.set(copyId, { url: asset.url, deleted: false });
      return copyId;
    },
    validation: { maxFileSize: SANDBOX_IMAGE_MAX_SIZE },
  };
  return {
    fileHandler,
    upload,
    get: (id: string) => findAsset(id)?.url,
    dispose: () => {
      entries.forEach(({ file, url }) => {
        if (file) URL.revokeObjectURL(url);
      });
      entries.clear();
      Object.keys(assetsUploadStatus).forEach((key) => {
        delete assetsUploadStatus[key];
      });
    },
  };
}

export type SandboxAssets = ReturnType<typeof createSandboxAssets>;

export function useSandboxAssets(remote?: SandboxRemoteAssets) {
  const assets = useMemo(() => createSandboxAssets(remote), [remote]);
  useEffect(() => () => assets.dispose(), [assets]);
  return { assets, fileHandler: assets.fileHandler };
}
