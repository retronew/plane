import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";

export type ProjectTemplateKind = "work_item" | "page";
export type Draft = Omit<WorkspaceTemplate, "id"> & { id?: string };

export function newProjectTemplate(kind: ProjectTemplateKind, projectId: string): Draft {
  return {
    kind,
    project: projectId,
    name: "",
    short_description: "",
    title: "",
    description_html: "<p></p>",
    priority: "none",
    configuration: {},
  };
}
