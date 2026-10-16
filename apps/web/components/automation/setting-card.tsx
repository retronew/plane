import { useId, type ReactNode } from "react";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";

/** Keep automation headers aligned with other boxed project settings. */
export function AutomationSettingCard({
  title,
  description,
  control,
  children,
  expanded,
}: {
  title: string;
  description: string;
  control: ReactNode;
  children: ReactNode;
  expanded: boolean;
}) {
  const panelId = useId();
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-subtle bg-layer-2">
      <div className="px-4 py-3">
        <SettingsBoxedControlItem
          title={title}
          description={description}
          control={control}
          className="rounded-none border-0 bg-transparent p-0"
        />
      </div>
      <div
        id={panelId}
        data-automation-panel=""
        data-expanded={expanded}
        inert={!expanded}
        aria-hidden={!expanded}
        className={
          expanded
            ? "grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
            : "grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        }
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-subtle bg-layer-1 p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
