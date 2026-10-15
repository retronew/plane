import { expect, it } from "vitest";
import { getCoverImagePayload, getCoverImageDisplayURL } from "./cover-image.helper";
it("does not turn an empty cover into a stock image", () => {
  expect(getCoverImageDisplayURL(null, null)).toBeNull();
  expect(getCoverImagePayload(undefined, "")).toBeUndefined();
});
it("clears every cover association when the cover is removed", () => {
  expect(getCoverImagePayload("https://example.test/cover.png", null)).toEqual({
    cover_image: null,
    cover_image_url: null,
    cover_image_asset: null,
  });
});
it("preserves a real uploaded or external cover without fetching or reuploading it", () => {
  const url = "https://example.test/cover.png";
  expect(getCoverImageDisplayURL(url, null)).toBe(url);
  expect(getCoverImagePayload(url, url)).toBeUndefined();
  expect(getCoverImagePayload(null, url)).toEqual({ cover_image: url, cover_image_url: url });
});
