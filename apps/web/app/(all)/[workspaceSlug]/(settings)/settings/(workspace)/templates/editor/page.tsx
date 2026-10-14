import { observer } from "mobx-react";
import { useParams } from "react-router";
import { TemplateEditor } from "@/components/settings/workspace/configuration/template-editor";
const ObservedEditor = observer(TemplateEditor);
export default function Page() {
  const { workspaceSlug, templateKind, templateId } = useParams();
  return <ObservedEditor key={`${workspaceSlug}:${templateKind}:${templateId ?? "new"}`} />;
}
