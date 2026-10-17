import { AxiosHeaders } from "axios";
import { expect, it, vi } from "vitest";
import { ProjectWorkflowService } from "./workflow.service";

it("sends the workflow filter with the execution offset and omits it for all project executions", async () => {
  const service = new ProjectWorkflowService();
  const get = vi.spyOn(service, "get").mockResolvedValue({
    data: { results: [], count: 0, next_offset: null },
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
  await service.executions("w", "p", 25, "flow");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/workflow-executions/", {
    params: { offset: 25, workflow_id: "flow" },
  });
  await service.executions("w", "p");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/workflow-executions/", {
    params: { offset: 0 },
  });
});
