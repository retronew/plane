import { getFileURL } from "@plane/utils";

export type TCoverImagePayload = {
  cover_image?: string | null;
  cover_image_url?: string | null;
  cover_image_asset?: string | null;
};

export function getCoverImageDisplayURL(
  imageUrl: string | null | undefined,
  fallbackUrl: string | null
): string | null {
  return imageUrl ? getFileURL(imageUrl) || imageUrl : fallbackUrl;
}

/** Uploads are complete before this runs; saving only updates or clears the cover association. */
export function getCoverImagePayload(
  currentImage: string | null | undefined,
  newImage: string | null | undefined
): TCoverImagePayload | undefined {
  if ((currentImage || null) === (newImage || null)) return;
  if (!newImage) return { cover_image: null, cover_image_url: null, cover_image_asset: null };
  return { cover_image: getFileURL(newImage) || newImage, cover_image_url: newImage };
}
