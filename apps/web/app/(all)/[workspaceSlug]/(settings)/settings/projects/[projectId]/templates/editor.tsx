import { observer } from "mobx-react";
import { useParams } from "react-router";
import { ProjectTemplateEditor } from "@/components/settings/project/templates/editor";

const ObservedEditor = observer(ProjectTemplateEditor);

export default function Page() {
  const { workspaceSlug, projectId, templateKind, templateId } = useParams();
  return <ObservedEditor key={`${workspaceSlug}:${projectId}:${templateKind}:${templateId ?? "new"}`} />;
}
