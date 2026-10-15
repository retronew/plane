import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import {
  CardLayoutOutline,
  BoardLayoutOutline,
  ListLayoutOutline,
  TimelineLayoutOutline,
} from "@makeplane/propel/icons";
import { Tabs, TabsList, Tab } from "@makeplane/propel/components/tabs";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import type { TProjectLayout } from "@plane/types";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
const layouts = [
  { key: "gallery", icon: CardLayoutOutline },
  { key: "board", icon: BoardLayoutOutline },
  { key: "list", icon: ListLayoutOutline },
  { key: "timeline", icon: TimelineLayoutOutline },
] as const;
export const ProjectLayoutSwitch = observer(function ProjectLayoutSwitch() {
  const { workspaceSlug } = useParams();
  const { currentWorkspaceDisplayFilters, updateDisplayFilters } = useProjectFilter();
  const { t } = useTranslation();
  return (
    <Tabs
      variant="contained"
      value={currentWorkspaceDisplayFilters?.layout ?? "gallery"}
      onValueChange={(next) => {
        if (workspaceSlug && layouts.some((item) => item.key === next))
          updateDisplayFilters(String(workspaceSlug), { layout: next as TProjectLayout });
      }}
    >
      <TabsList>
        {layouts.map(({ key, icon: Icon }) => (
          <Tooltip key={key} label={t(`web.project_page.layouts.${key}`)}>
            <Tab
              value={key}
              label=""
              aria-label={t(`web.project_page.layouts.${key}`)}
              data-testid={`project-layout-${key}`}
              icon={<Icon className="size-4" />}
            />
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
});
