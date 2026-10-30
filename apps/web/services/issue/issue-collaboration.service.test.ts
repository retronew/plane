import { expect, it, vi } from "vitest";
import { IssueCollaborationService, parseIssueCollaborationDocument } from "./issue-collaboration.service";
vi.mock("@plane/constants", () => ({ API_BASE_URL: "http://localhost" }));
const transport = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = transport.get;
  },
}));
const valid = {
  can_read: true,
  can_edit: false,
  epoch: 0,
  revision: 2,
  format: "slate-yjs-v1",
  description_html: "<p>safe</p>",
};
it("accepts an accessible supported document including read-only permissions", () => {
  expect(parseIssueCollaborationDocument(valid)).toEqual(valid);
});
it.each([
  null,
  [],
  "invalid",
  { ...valid, can_read: false },
  { ...valid, can_edit: "true" },
  { ...valid, epoch: -1 },
  { ...valid, epoch: 1.5 },
  { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 },
  { ...valid, format: "tiptap" },
  { ...valid, description_html: {} },
])("rejects malformed or inaccessible responses: %j", (value) => {
  expect(() => parseIssueCollaborationDocument(value)).toThrow();
});
it("validates actual transport responses before returning them", async () => {
  transport.get.mockResolvedValue({ data: { ...valid, epoch: "1" } });
  await expect(new IssueCollaborationService().retrieve("w", "p", "i")).rejects.toThrow();
});
