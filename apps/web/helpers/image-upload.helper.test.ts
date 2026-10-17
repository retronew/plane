import { describe, expect, it } from "vitest";
import { EFileAssetType } from "@plane/types";
import { getImageUploadGeometry, IMAGE_UPLOAD_PROFILES, optimizeImageForUpload } from "./image-upload.helper";

describe("image upload geometry", () => {
  it("crops a portrait photo to the centered project banner before resizing", () => {
    const geometry = getImageUploadGeometry(3000, 4000, IMAGE_UPLOAD_PROFILES[EFileAssetType.PROJECT_COVER]!);
    expect(geometry).toEqual({ x: 0, y: 1500, sourceWidth: 3000, sourceHeight: 1000, width: 1920, height: 640 });
  });

  it("crops a panorama horizontally for profile covers", () => {
    expect(getImageUploadGeometry(6000, 1200, IMAGE_UPLOAD_PROFILES[EFileAssetType.USER_COVER]!)).toEqual({
      x: 1400,
      y: 0,
      sourceWidth: 3200,
      sourceHeight: 1200,
      width: 1600,
      height: 600,
    });
  });

  it("does not enlarge small images", () => {
    expect(getImageUploadGeometry(120, 80, IMAGE_UPLOAD_PROFILES[EFileAssetType.USER_AVATAR]!)).toEqual({
      x: 20,
      y: 0,
      sourceWidth: 80,
      sourceHeight: 80,
      width: 80,
      height: 80,
    });
  });

  it.each([0, -1, Infinity, NaN])("rejects invalid dimensions %s", (width) => {
    expect(() => getImageUploadGeometry(width, 100, IMAGE_UPLOAD_PROFILES[EFileAssetType.USER_COVER]!)).toThrow();
  });

  it.each(["image/webp", "image/png"])(
    "preserves animation in %s without decoding into a static canvas",
    async (type) => {
      const bytes = new Uint8Array(45);
      const write = (offset: number, text: string) => bytes.set(new TextEncoder().encode(text), offset);
      if (type === "image/webp") {
        write(0, "RIFF");
        write(8, "WEBP");
        write(12, "VP8X");
        bytes[20] = 2;
      } else {
        // IHDR (13 bytes of data + 12 bytes overhead), then APNG animation control.
        new DataView(bytes.buffer).setUint32(8, 13);
        write(12, "IHDR");
        write(37, "acTL");
      }
      const file = new File([bytes], "animated", { type });
      expect(await optimizeImageForUpload(file, EFileAssetType.USER_COVER)).toBe(file);
    }
  );

  it("leaves attachments, editor images and unsupported formats intact without needing a browser", async () => {
    await Promise.all(
      [EFileAssetType.ISSUE_ATTACHMENT, EFileAssetType.PROJECT_ATTACHMENT, EFileAssetType.PAGE_DESCRIPTION].map(
        async (type) => {
          const file = new File(["original"], "photo.png", { type: "image/png" });
          expect(await optimizeImageForUpload(file, type)).toBe(file);
        }
      )
    );
    const gif = new File(["animation"], "animated.gif", { type: "image/gif" });
    expect(await optimizeImageForUpload(gif, EFileAssetType.USER_COVER)).toBe(gif);
  });
});
