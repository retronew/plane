import { Tab, TabsList } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";

export type TIntakeActivityTab = "all" | "activity" | "comments" | "transitions" | "history";
const tabs = [
  ["all", "common.all"],
  ["activity", "common.activity"],
  ["comments", "common.comments"],
  ["transitions", "web.runtime.intake_activity_transitions"],
  ["history", "history"],
] as const;

export function IntakeActivityTabs({
  value,
  onChange,
}: {
  value: TIntakeActivityTab;
  onChange: (value: TIntakeActivityTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <AnimatedUnderlineTabs value={value} onValueChange={(next) => onChange(next as TIntakeActivityTab)}>
      <TabsList>
        {tabs.map(([key, label]) => (
          <Tab key={key} value={key} label={t(label)} />
        ))}
      </TabsList>
    </AnimatedUnderlineTabs>
  );
}
