import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";

export const TEMPLATE_KINDS = ["project", "work_item", "page"] as const;
export const templateRouteKind = (kind: WorkspaceTemplate["kind"]) => (kind === "work_item" ? "work-item" : kind);
