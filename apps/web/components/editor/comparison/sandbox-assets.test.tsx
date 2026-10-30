import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { COMPARISON_IMAGE } from "./sample";
import { createSandboxAssets, SANDBOX_IMAGE_MAX_SIZE, useSandboxAssets } from "./sandbox-assets";

describe("comparison sandbox assets", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => `blob:${crypto.randomUUID()}`), revokeObjectURL: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the bundled sample available through StrictMode replay, deletion, and resets", async () => {
    const { result, rerender, unmount } = renderHook(useSandboxAssets, { wrapper: StrictMode });
    const { assets, fileHandler } = result.current;
    expect(assets.get(COMPARISON_IMAGE.id)).toBe(COMPARISON_IMAGE.url);
    await fileHandler.delete(COMPARISON_IMAGE.id);
    expect(await fileHandler.getAssetSrc(COMPARISON_IMAGE.id)).toBe(COMPARISON_IMAGE.url);
    await fileHandler.restore(COMPARISON_IMAGE.id);
    const copy = await fileHandler.duplicate(COMPARISON_IMAGE.id);
    expect(copy).not.toBe(COMPARISON_IMAGE.id);
    expect(await fileHandler.getAssetDownloadSrc(copy)).toBe(COMPARISON_IMAGE.url);
    rerender();
    expect(result.current.assets).toBe(assets);
    expect(await fileHandler.checkIfAssetExists(COMPARISON_IMAGE.id)).toBe(true);
    assets.dispose();
    expect(assets.get(COMPARISON_IMAGE.id)).toBe(COMPARISON_IMAGE.url);
    expect(assets.get(copy)).toBeUndefined();
    unmount();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("validates images and permits exactly 5 MB", async () => {
    const assets = createSandboxAssets();
    await expect(assets.upload("x", new File(["text"], "text.txt", { type: "text/plain" }))).rejects.toThrow();
    await expect(
      assets.upload("x", new File([new Uint8Array(SANDBOX_IMAGE_MAX_SIZE + 1)], "big.png", { type: "image/png" }))
    ).rejects.toThrow();
    await expect(
      assets.upload("x", new File([new Uint8Array(SANDBOX_IMAGE_MAX_SIZE)], "ok.png", { type: "image/png" }))
    ).resolves.toMatch(/^[\da-f-]{36}$/);
    assets.dispose();
  });

  it("retains shared references through delete, undo, and independent duplication", async () => {
    const assets = createSandboxAssets();
    const id = await assets.upload("block", new File(["image"], "test.png", { type: "image/png" }));
    const url = await assets.fileHandler.getAssetSrc(id);
    await assets.fileHandler.delete(id);
    expect(await assets.fileHandler.checkIfAssetExists(id)).toBe(true);
    expect(await assets.fileHandler.getAssetSrc(id)).toBe(url);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await assets.fileHandler.restore(id);
    const copy = await assets.fileHandler.duplicate(id);
    expect(copy).not.toBe(id);
    expect(await assets.fileHandler.getAssetDownloadSrc(copy)).not.toBe(url);
    assets.dispose();
    assets.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(await assets.fileHandler.checkIfAssetExists(id)).toBe(false);
  });

  it("resolves uploaded assets in another room client and retains undo references", async () => {
    const id = crypto.randomUUID();
    const remote = {
      upload: vi.fn(async () => id),
      get: (key: string) => (key === id ? `/sandbox/assets/${key}?room=test` : undefined),
    };
    const first = createSandboxAssets(remote);
    const second = createSandboxAssets(remote);
    expect(await first.upload("block", new File(["image"], "shared.png", { type: "image/png" }))).toBe(id);
    expect(second.get(id)).toBe(first.get(id));
    await first.fileHandler.delete(id);
    expect(second.get(id)).toBeTruthy();
    expect(await second.fileHandler.duplicate(id)).toBe(id);
    first.dispose();
    expect(first.get(id)).toBe(second.get(id));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("propagates remote upload errors without inserting local assets", async () => {
    const assets = createSandboxAssets({
      upload: async () => {
        throw new Error("Forbidden");
      },
      get: () => undefined,
    });
    await expect(assets.upload("block", new File(["image"], "x.png", { type: "image/png" }))).rejects.toThrow(
      "Forbidden"
    );
    expect(assets.fileHandler.assetsUploadStatus.block).toBeUndefined();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("isolates pages and releases every URL when the owner unmounts", async () => {
    const { result, unmount } = renderHook(useSandboxAssets);
    const id = await result.current.assets.upload("block", new File(["image"], "x.png", { type: "image/png" }));
    expect(createSandboxAssets().get(id)).toBeUndefined();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
