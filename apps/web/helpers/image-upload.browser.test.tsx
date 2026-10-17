import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { optimizeImageForUpload } from "./image-upload.helper";

const draw = vi.fn();
let imageWidth = 4000;
let imageHeight = 3000;
let decodeFails = false;
let encoded: Blob | null;
const revoke = vi.fn();

beforeEach(() => {
  imageWidth = 4000;
  imageHeight = 3000;
  decodeFails = false;
  encoded = new Blob(["webp"], { type: "image/webp" });
  vi.stubGlobal(
    "File",
    class extends File {
      async arrayBuffer() {
        return new ArrayBuffer(0);
      }
    }
  );
  draw.mockClear();
  revoke.mockClear();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: revoke });
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = imageWidth;
      naturalHeight = imageHeight;
      private listeners = new Map<string, () => void>();
      addEventListener(type: string, handler: () => void) {
        this.listeners.set(type, handler);
      }
      set src(_value: string) {
        queueMicrotask(() => this.listeners.get(decodeFails ? "error" : "load")?.());
      }
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(encoded));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browser image preparation", () => {
  it("encodes the centered crop as WebP and releases resources", async () => {
    const file = new File(["original photo"], "photo.JPG", { type: "image/jpeg" });
    const result = await optimizeImageForUpload(file, EFileAssetType.PROJECT_COVER);
    expect(result.name).toBe("photo.webp");
    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(encoded!.size);
    expect(draw.mock.calls[0].slice(1, 5)).toEqual([0, (3000 - 4000 / 3) / 2, 4000, 4000 / 3]);
    expect(draw.mock.calls.at(-1)?.slice(-2)).toEqual([1920, 640]);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.88);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    const finalCanvas = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.instances[0] as HTMLCanvasElement;
    expect(finalCanvas.width).toBe(0);
    expect(finalCanvas.height).toBe(0);
  });

  it("uses the actual PNG type and extension when the browser lacks WebP encoding", async () => {
    encoded = new Blob(["png"], { type: "image/png" });
    const result = await optimizeImageForUpload(
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      EFileAssetType.USER_COVER
    );
    expect(result.name).toBe("photo.png");
    expect(result.type).toBe("image/png");
  });

  it.each(["decode", "encode"])("fails before upload and releases its object URL on %s failure", async (failure) => {
    decodeFails = failure === "decode";
    encoded = null;
    await expect(
      optimizeImageForUpload(new File(["invalid"], "photo.png", { type: "image/png" }), EFileAssetType.USER_COVER)
    ).rejects.toThrow();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it.each(["image/webp", "image/png", "image/jpeg"])(
    "keeps a smaller %s that already has the required dimensions",
    async (type) => {
      imageWidth = 256;
      imageHeight = 256;
      encoded = new Blob(["larger webp output"], { type: "image/webp" });
      const file = new File(["small"], "avatar", { type });
      expect(await optimizeImageForUpload(file, EFileAssetType.USER_AVATAR)).toBe(file);
      expect(draw.mock.calls[0].slice(-2)).toEqual([256, 256]);
    }
  );
});
