import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { FileService } from "./file.service";

const mocks = vi.hoisted(() => ({ optimize: vi.fn(), metadata: vi.fn(), upload: vi.fn() }));
vi.mock("@/helpers/image-upload.helper", () => ({ optimizeImageForUpload: mocks.optimize }));
vi.mock("@plane/services", async (original) => ({
  ...(await original<typeof import("@plane/services")>()),
  getFileMetaDataForUpload: mocks.metadata,
}));
vi.mock("@/services/file-upload.service", () => ({
  FileUploadService: class {
    uploadFile = mocks.upload;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

it.each(["workspace", "user", "project"])(
  "signs and uploads the optimized file through the %s endpoint",
  async (endpoint) => {
    const service = new FileService();
    const original = new File(["original large photo"], "photo.jpg", { type: "image/jpeg" });
    const optimized = new File(["webp"], "photo.webp", { type: "image/webp" });
    mocks.optimize.mockResolvedValue(optimized);
    mocks.metadata.mockImplementation(async (file: File) => ({ name: file.name, size: file.size, type: file.type }));
    const signed = {
      asset_id: "asset",
      asset_url: "/cover/",
      upload_data: { url: "https://storage.example.test", fields: { key: "cover.webp" } },
    };
    const post = vi.spyOn(service, "post").mockResolvedValue({ data: signed } as never);
    vi.spyOn(service, "patch").mockResolvedValue({ data: undefined } as never);
    const info = { entity_type: EFileAssetType.PROJECT_COVER, entity_identifier: "project" };
    if (endpoint === "workspace") await service.uploadWorkspaceAsset("workspace", info, original);
    else if (endpoint === "user") await service.uploadUserAsset(info, original);
    else await service.uploadProjectAsset("workspace", "project", info, original);

    expect(mocks.optimize).toHaveBeenCalledWith(original, info.entity_type);
    expect(mocks.metadata).toHaveBeenCalledWith(optimized);
    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "photo.webp", type: "image/webp", size: optimized.size })
    );
    const payload = mocks.upload.mock.calls[0][1] as FormData;
    expect((payload.get("file") as File).name).toBe("photo.webp");
    expect((payload.get("file") as File).size).toBe(optimized.size);
    expect((payload.get("file") as File).type).toBe("image/webp");
  }
);

it("does not request a signed URL when image processing fails", async () => {
  const service = new FileService();
  const post = vi.spyOn(service, "post");
  mocks.optimize.mockRejectedValue(new Error("Invalid image"));
  await expect(
    service.uploadUserAsset(
      { entity_type: EFileAssetType.USER_COVER, entity_identifier: "" },
      new File(["bad"], "photo.png", { type: "image/png" })
    )
  ).rejects.toThrow("Invalid image");
  expect(post).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
