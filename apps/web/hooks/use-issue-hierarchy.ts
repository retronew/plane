import useSWR from "swr";
import { useParams } from "react-router";
import { ProjectWorkflowService } from "@/services/project/workflow.service";

const service = new ProjectWorkflowService();

export function useIssueHierarchy(projectId?: string | null) {
  const { workspaceSlug } = useParams();
  return useSWR(
    workspaceSlug && projectId ? ["issue-hierarchy", workspaceSlug, projectId] : null,
    ([, slug, project]: [string, string, string]) => service.hierarchy(slug, project)
  );
}
