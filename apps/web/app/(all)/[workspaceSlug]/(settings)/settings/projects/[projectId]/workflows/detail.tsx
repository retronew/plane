import { useParams } from "react-router";
import { WorkflowSettings } from "@/components/workflow/settings";

export default function WorkflowDetailPage() {
  const { workflowId } = useParams();
  return <WorkflowSettings key={workflowId} detail />;
}
