import { expect, it, vi } from "vitest";
import { AxiosHeaders } from "axios";
import { ProjectPageService } from "./project-page.service";

it.each([{ labelIds: ["label"] }, { labelIds: [] }])(
  "writes page label relations through labels: $labelIds",
  async ({ labelIds }) => {
    const service = new ProjectPageService();
    const patch = vi.spyOn(service, "patch").mockResolvedValue({
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    await service.update("workspace", "project", "page", { label_ids: labelIds });
    expect(patch).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/pages/page/", { labels: labelIds });
  }
);

it("keeps unrelated partial updates free of label fields", async () => {
  const service = new ProjectPageService();
  const patch = vi.spyOn(service, "patch").mockResolvedValue({
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
  await service.update("workspace", "project", "page", { name: "Renamed" });
  expect(patch).toHaveBeenCalledWith("/api/workspaces/workspace/projects/project/pages/page/", { name: "Renamed" });
});
