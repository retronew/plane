import { workflowDisplayName } from "./display-name";
import { useState } from "react";
import { Menu, MenuContent, MenuLinkItem, MenuSearch, MenuTrigger } from "@makeplane/propel/components/menu";
import { ChevronDownOutline, TickOutline, WorkflowsOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow } from "@plane/types";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

export type WorkflowSwitcherProps = {
  workflows: TProjectWorkflow[];
  currentId: string;
  base: string;
};

export function WorkflowSwitcher({ workflows, currentId, base }: WorkflowSwitcherProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const current =
    workflows.find((workflow) => (workflow.workflow_id ?? workflow.id) === currentId) ??
    workflows.find((workflow) => workflow.id === currentId);
  const name = workflowDisplayName(current, t("web.workflow_ui.default_name"));
  const query = search.trim().toLowerCase();
  const filtered = workflows.filter((workflow) =>
    workflowDisplayName(workflow, t("web.workflow_ui.default_name")).toLowerCase().includes(query)
  );

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={name}
            className="group/workflow-switcher inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1 outline-none hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid data-popup-open:bg-layer-transparent-hover"
          >
            <BreadcrumbLink
              label={name}
              icon={<WorkflowsOutline className="size-4 text-tertiary" />}
              disableTooltip
              isLast
            />
            <ChevronDownOutline className="size-3.5 shrink-0 text-icon-secondary" />
          </button>
        }
      />
      <MenuContent
        side="bottom"
        align="start"
        search={
          <MenuSearch
            value={search}
            onValueChange={setSearch}
            aria-label={t("web.workflow_ui.search")}
            placeholder={t("web.workflow_ui.search")}
          />
        }
      >
        {filtered.map((workflow) => (
          <MenuLinkItem
            key={workflow.workflow_id ?? workflow.id}
            href={base + (workflow.workflow_id ?? workflow.id)}
            label={workflowDisplayName(workflow, t("web.workflow_ui.default_name"))}
            icon={<WorkflowsOutline className="size-4" />}
            aria-current={workflow === current ? "page" : undefined}
            trailing={workflow === current ? <TickOutline className="size-3.5" /> : undefined}
          />
        ))}
        {filtered.length === 0 && (
          <output className="block px-2 py-3 text-center text-body-xs-regular text-tertiary">
            {t("common.search.no_matches_found")}
          </output>
        )}
      </MenuContent>
    </Menu>
  );
}
