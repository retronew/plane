import { Icon } from "@makeplane/propel/components/icon";
import { MenuItem } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { getDisabledReason, resolveItemVariant } from "@plane/blocks/context-menu";
import type { TContextMenuItem } from "@plane/blocks/context-menu";

/** Shared leaf row for entity quick actions, including disabled archive explanations. */
export function QuickActionMenuItem({ item }: { item: TContextMenuItem }) {
  const disabledReason = getDisabledReason(item);
  const row = (
    <MenuItem
      variant={resolveItemVariant(item)}
      icon={item.customContent ?? (item.icon ? <Icon icon={item.icon} /> : undefined)}
      label={item.title ?? ""}
      description={disabledReason ? undefined : item.description}
      selected={item.selected}
      disabled={item.disabled}
      aria-description={disabledReason}
      closeOnClick={item.closeOnClick !== false}
      onClick={(event) => {
        event.stopPropagation();
        item.action();
      }}
    />
  );

  if (!disabledReason) return row;
  return (
    <Tooltip label={disabledReason} side="right" layout="stacked">
      {/* Disabled menu rows remain arrow-key focusable; focus bubbles to the tooltip trigger. */}
      <span className="block">{row}</span>
    </Tooltip>
  );
}
