import { AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import {
  configurationKey,
  projectConfigurationKey,
  WorkspaceConfigurationService,
  type WorkspaceTemplate,
} from "./workspace-configuration.service";

const response = <T>(data: T) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

afterEach(() => vi.restoreAllMocks());

it("reads templates and options from their explicit project scope", async () => {
  const service = new WorkspaceConfigurationService();
  const template = { id: "template", project: "p", kind: "work_item" };
  const get = vi.spyOn(service, "get").mockResolvedValue(response([template]));
  expect(await service.listProjectTemplates("w", "p")).toEqual([template]);
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/templates/");
  get.mockResolvedValue(response(template));
  expect(await service.projectTemplate("w", "p", "template")).toEqual(template);
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/templates/template/");
  const options = { projects: [], members: [], states: [{ id: "s", name: "Todo" }] };
  get.mockResolvedValue(response(options));
  expect(await service.projectTemplateOptions("w", "p")).toEqual(options);
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/projects/p/template-options/");
});

it("creates, updates and deletes project templates without using workspace write endpoints", async () => {
  const service = new WorkspaceConfigurationService();
  const draft: Partial<WorkspaceTemplate> = {
    kind: "work_item",
    name: "Bug report",
    configuration: {
      type_id: "bug",
      children: [{ name: "Reproduce", description_html: "", state_id: "todo", priority: "high" }],
    },
  };
  const saved = { ...draft, id: "template", project: "p" };
  const post = vi.spyOn(service, "post").mockResolvedValue(response(saved));
  const patch = vi.spyOn(service, "patch").mockResolvedValue(response(saved));
  const remove = vi.spyOn(service, "delete").mockResolvedValue(response(undefined));
  expect(await service.saveProjectTemplate("w", "p", draft)).toEqual(saved);
  expect(post).toHaveBeenCalledWith("/api/workspaces/w/projects/p/templates/", draft);
  expect(patch).not.toHaveBeenCalled();
  expect(await service.saveProjectTemplate("w", "p", saved)).toEqual(saved);
  expect(patch).toHaveBeenCalledWith("/api/workspaces/w/projects/p/templates/template/", saved);
  await service.removeProjectTemplate("w", "p", "template");
  expect(remove).toHaveBeenCalledWith("/api/workspaces/w/projects/p/templates/template/");
});

it("keeps workspace requests compatible and separates cache entries by project", async () => {
  const service = new WorkspaceConfigurationService();
  const get = vi.spyOn(service, "get").mockResolvedValue(response([]));
  await service.list("w", "templates");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/templates/");
  await service.templateOptions("w", "p");
  expect(get).toHaveBeenLastCalledWith("/api/workspaces/w/template-options/", { params: { project: "p" } });
  expect(projectConfigurationKey("w", "p")).not.toBe(configurationKey("w", "templates"));
  expect(projectConfigurationKey("w", "p")).not.toBe(projectConfigurationKey("w", "other"));
  expect(projectConfigurationKey("w", "p")).not.toBe(projectConfigurationKey("other", "p"));
});
