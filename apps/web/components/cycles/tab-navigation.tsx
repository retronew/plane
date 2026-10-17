import { TabsList } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { UnderlineTabLink } from "@/components/navigation/underline-tab-link";

export type CycleTab = "active" | "upcoming" | "completed";

export function CycleTabNavigation({
  workspaceSlug,
  projectId,
  tab,
}: {
  workspaceSlug: string;
  projectId: string;
  tab: CycleTab;
}) {
  const { t } = useTranslation();
  const tabs = [
    { key: "active", label: t("common.in_progress") },
    { key: "upcoming", label: t("common.upcoming") },
    { key: "completed", label: t("common.completed") },
  ];
  return (
    <AnimatedUnderlineTabs fillHeight value={tab} motionKey={`/${workspaceSlug}/projects/${projectId}/cycles`}>
      <TabsList>
        {tabs.map(({ key, label }) => (
          <UnderlineTabLink
            key={key}
            value={key}
            label={label}
            to={`/${workspaceSlug}/projects/${projectId}/cycles?tab=${key}`}
            linkProps={{
              onClick: (event) => {
                if (tab === key) event.preventDefault();
              },
            }}
          />
        ))}
      </TabsList>
    </AnimatedUnderlineTabs>
  );
}
