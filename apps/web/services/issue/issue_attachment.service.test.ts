import { beforeEach, expect, it, vi } from "vitest";
import { IssueAttachmentService } from "./issue_attachment.service";

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

beforeEach(() => vi.clearAllMocks());

it.each([
  ["notes.txt", "text/plain", "", "text/plain"],
  ["report.csv", "text/csv", "", "text/csv"],
  ["unknown.obj", "", "", "application/octet-stream"],
  ["photo.png", "application/octet-stream", "image/png", "image/png"],
])("signs and completes %s using a nonempty MIME type", async (name, type, detectedType, expectedType) => {
  const service = new IssueAttachmentService();
  const file = new File(["sample"], name, { type });
  mocks.metadata.mockResolvedValue({ name, size: file.size, type: detectedType });
  const attachment = { id: "asset", attributes: { name, size: file.size } };
  const signed = {
    asset_id: "asset",
    attachment,
    upload_data: { url: "https://storage.example.test", fields: { key: name } },
  };
  const post = vi.spyOn(service, "post").mockResolvedValue({ data: signed } as never);
  const patch = vi.spyOn(service, "patch").mockResolvedValue({} as never);
  await expect(service.uploadIssueAttachment("workspace", "project", "issue", file)).resolves.toBe(attachment);
  expect(post).toHaveBeenCalledWith(expect.stringContaining("/issues/issue/attachments/"), {
    name,
    size: file.size,
    type: expectedType,
  });
  expect((mocks.upload.mock.calls[0][1] as FormData).get("file")).toBe(file);
  expect(patch).toHaveBeenCalledWith(expect.stringContaining("/attachments/asset/"));
});

it("preserves the storage failure and does not mark a failed upload complete", async () => {
  const service = new IssueAttachmentService();
  mocks.metadata.mockResolvedValue({ name: "notes.txt", size: 1, type: "text/plain" });
  vi.spyOn(service, "post").mockResolvedValue({
    data: { asset_id: "asset", upload_data: { url: "https://storage.example.test", fields: {} } },
  } as never);
  const patch = vi.spyOn(service, "patch");
  const failure = { error: "Storage upload failed" };
  mocks.upload.mockRejectedValueOnce(failure);
  await expect(
    service.uploadIssueAttachment("workspace", "project", "issue", new File(["x"], "notes.txt"))
  ).rejects.toBe(failure);
  expect(patch).not.toHaveBeenCalled();
});
