import { EFileAssetType } from "@plane/types";

type TImageUploadProfile = {
  width: number;
  height: number;
  crop: boolean;
};

// Covers appear in both narrow cards and wide headers. Keep enough vertical
// content for the cards and enough pixels for a 2x display of the wide header.
export const IMAGE_UPLOAD_PROFILES: Partial<Record<EFileAssetType, TImageUploadProfile>> = {
  [EFileAssetType.PROJECT_COVER]: { width: 1920, height: 640, crop: true },
  [EFileAssetType.USER_COVER]: { width: 1600, height: 600, crop: true },
  [EFileAssetType.USER_AVATAR]: { width: 256, height: 256, crop: true },
  [EFileAssetType.WORKSPACE_LOGO]: { width: 256, height: 256, crop: true },
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const WEBP_QUALITY = 0.88;

export function getImageUploadGeometry(width: number, height: number, profile: TImageUploadProfile) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid image dimensions");
  }
  const ratio = profile.width / profile.height;
  const sourceWidth = profile.crop ? Math.min(width, height * ratio) : width;
  const sourceHeight = profile.crop ? Math.min(height, width / ratio) : height;
  const scale = Math.min(1, profile.width / sourceWidth, profile.height / sourceHeight);
  return {
    x: (width - sourceWidth) / 2,
    y: (height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

async function isAnimatedImage(file: File): Promise<boolean> {
  if (file.type !== "image/webp" && file.type !== "image/png") return false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkName = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (file.type === "image/webp") {
    return chunkName(0) === "RIFF" && chunkName(8) === "WEBP" && chunkName(12) === "VP8X" && !!(bytes[20] & 2);
  }
  const view = new DataView(bytes.buffer);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const type = chunkName(offset + 4);
    if (type === "acTL") return true;
    // APNG animation control must precede the first image data chunk.
    if (type === "IDAT" || type === "IEND") return false;
    offset += 12 + view.getUint32(offset);
  }
  return false;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function encodeImage(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && (blob.type === "image/webp" || blob.type === "image/png")) resolve(blob);
        else reject(new Error("Could not encode image"));
      },
      "image/webp",
      WEBP_QUALITY
    );
  });
}

/** Prepare decorative images before signing: metadata and uploaded bytes must agree. */
export async function optimizeImageForUpload(file: File, entityType: EFileAssetType): Promise<File> {
  const profile = IMAGE_UPLOAD_PROFILES[entityType];
  if (!profile || !SUPPORTED_IMAGE_TYPES.has(file.type) || (await isAnimatedImage(file))) return file;

  // oxlint-disable-next-line react-doctor/no-create-object-url-without-revoke -- revoked in the `finally` block below, which runs on every path (success, early return, or throw).
  const url = URL.createObjectURL(file);
  const canvases: HTMLCanvasElement[] = [];
  try {
    const image = new Image();
    // Browser image decoding applies EXIF orientation before exposing dimensions.
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("Could not decode image")), { once: true });
      image.src = url;
    });
    const geometry = getImageUploadGeometry(image.naturalWidth, image.naturalHeight, profile);
    // Reduce in steps of at most 2x to retain detail when shrinking large photos.
    let width = geometry.sourceWidth;
    let height = geometry.sourceHeight;
    let source: CanvasImageSource = image;
    let firstPass = true;
    let result: HTMLCanvasElement;
    do {
      const nextWidth = Math.max(geometry.width, Math.round(width / 2));
      const nextHeight = Math.max(geometry.height, Math.round(height / 2));
      const { canvas, context } = createCanvas(nextWidth, nextHeight);
      canvases.push(canvas);
      context.drawImage(
        source,
        firstPass ? geometry.x : 0,
        firstPass ? geometry.y : 0,
        width,
        height,
        0,
        0,
        nextWidth,
        nextHeight
      );
      source = result = canvas;
      firstPass = false;
      width = nextWidth;
      height = nextHeight;
    } while (width > geometry.width || height > geometry.height);

    const blob = await encodeImage(result);
    // Keep already small images when re-encoding would only increase traffic.
    if (file.size <= blob.size && image.naturalWidth === geometry.width && image.naturalHeight === geometry.height) {
      return file;
    }
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
    for (const canvas of canvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
