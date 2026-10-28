import { CornerUpRight } from "lucide-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { translate } from "@plane/i18n";

export function KanbanParentIndicator({ parentName }: { parentName?: string }) {
  const parentLabel = translate("common.parent");
  const label = parentName ? `${parentLabel} · ${parentName}` : parentLabel;

  return (
    <Tooltip label={label}>
      <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-body-xs-regular text-tertiary">
        <CornerUpRight className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate" title={label}>
          {parentName || parentLabel}
        </span>
      </span>
    </Tooltip>
  );
}
