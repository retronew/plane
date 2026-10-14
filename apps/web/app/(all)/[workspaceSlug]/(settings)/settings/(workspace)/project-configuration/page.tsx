import { ProjectStateSettings } from "@/components/settings/workspace/configuration/project-state-settings";
import { useState } from "react";
import { useTranslation } from "@plane/i18n";
import { Tab, Tabs, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { WorkspaceFeatureSettings } from "@/components/settings/workspace/feature-settings";
import { CategoryManager } from "@/components/settings/workspace/configuration/category-manager";
export default function Page() {
  const [kind, setKind] = useState<"status" | "label">("status");
  const { t } = useTranslation();
  return (
    <WorkspaceFeatureSettings feature="projects" field="allow_member_project_creation">
      <Tabs
        variant="underline"
        value={kind}
        onValueChange={(value) => {
          if (value === "status" || value === "label") setKind(value);
        }}
      >
        <TabsList>
          {(["status", "label"] as const).map((value) => (
            <Tab
              key={value}
              value={value}
              label={t(value === "status" ? "web.project_statuses" : "web.project_labels")}
            />
          ))}
        </TabsList>
        {(["status", "label"] as const).map((value) => (
          <TabsPanel key={value} value={value}>
            <div className="pt-6">
              {value === "status" ? <ProjectStateSettings /> : <CategoryManager kind="label" />}
            </div>
          </TabsPanel>
        ))}
      </Tabs>
    </WorkspaceFeatureSettings>
  );
}
