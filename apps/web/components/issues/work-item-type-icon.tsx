import { observer } from "mobx-react";
import { WorkItemsOutline } from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";

/** Resolve the type within the work item's project, including inactive assigned types. */
export const WorkItemTypeIcon = observer(function WorkItemTypeIcon({
  projectId,
  typeId,
}: {
  projectId?: string | null;
  typeId?: string | null;
}) {
  const store = useProjectWorkflow(projectId ?? undefined);
  const type = typeId ? store.issueTypes[projectId ?? ""]?.results.find((item) => item.id === typeId) : undefined;
  const logo = type?.logo_props as TLogoProps | undefined;
  const hasLogo = (logo?.in_use === "emoji" && !!logo.emoji?.value) || (logo?.in_use === "icon" && !!logo.icon?.name);
  const color = logo?.in_use === "icon" && typeof logo.icon?.color === "string" ? logo.icon.color : undefined;
  const FallbackIcon = WorkItemsOutline;
  return (
    <Tooltip label={type?.name ?? ""} disabled={!type?.name}>
      <span
        data-work-item-type-icon={type?.id ?? ""}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-tertiary"
        style={color ? { backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)` } : undefined}
      >
        {hasLogo ? <Logo logo={logo} size={12} background={false} /> : <FallbackIcon className="size-3" />}
      </span>
    </Tooltip>
  );
});
