import { useId, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRightOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { ProjectActiveCycle } from "../active-cycle/project-active-cycle";
import type { ProjectActiveCycleProps } from "../active-cycle/project-active-cycle";
import { CyclesListItem } from "./cycles-list-item";

type Props = ProjectActiveCycleProps & { defaultOpen: boolean };

export function ActiveCycleDisclosure({ defaultOpen, ...props }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const { t } = useTranslation();

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="shrink-0 border-b border-subtle">
      <CyclesListItem
        {...props}
        className={open ? "border-b border-subtle" : "border-b-0"}
        disclosure={{ expanded: open, onToggle: () => setOpen(!open), panelId }}
        leadingElement={
          <Collapsible.Trigger
            aria-label={t("project_cycles.more_details")}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <ChevronRightOutline className={cn("size-3 transition-transform", open && "rotate-90")} />
          </Collapsible.Trigger>
        }
      />
      <Collapsible.Panel id={panelId}>
        <ProjectActiveCycle {...props} showCycleHeader={false} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
