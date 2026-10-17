/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { FileService } from "./file.service";

const mocks = vi.hoisted(() => ({ metadata: vi.fn(), upload: vi.fn() }));
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
  mocks.upload.mockResolvedValue(undefined);
});

it.each([
  { browserType: "text/plain", detected: "", expected: "text/plain" },
  { browserType: "", detected: "", expected: "application/octet-stream" },
  { browserType: "application/octet-stream", detected: "application/pdf", expected: "application/pdf" },
])("signs and completes attachments with MIME $expected", async ({ browserType, detected, expected }) => {
  const service = new FileService();
  const file = new File(["contents"], "attachment.txt", { type: browserType });
  mocks.metadata.mockResolvedValue({ name: file.name, size: file.size, type: detected });
  const signed = {
    asset_id: "asset",
    asset_url: "/asset/",
    upload_data: { url: "https://storage.example.test", fields: { key: "object" } },
  };
  const post = vi.spyOn(service, "post").mockResolvedValue({ data: signed } as never);
  const patch = vi.spyOn(service, "patch").mockResolvedValue({ data: undefined } as never);
  await service.uploadProjectAsset(
    "workspace",
    "project",
    { entity_type: EFileAssetType.PROJECT_ATTACHMENT, entity_identifier: "project" },
    file
  );
  expect(post).toHaveBeenCalledWith(
    "/api/assets/v2/workspaces/workspace/projects/project/",
    expect.objectContaining({ type: expected })
  );
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(patch).toHaveBeenCalledWith("/api/assets/v2/workspaces/workspace/projects/project/asset/");
});
