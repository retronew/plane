import type { ReactNode } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Switch } from "@makeplane/propel/components/switch";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Plus } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { STATE_SWITCH_SLOT_CLASS_NAME } from "./row-layout";

/** Shared state-group chrome; adapters own persistence and group semantics. */
export function StateGroupPanel({
  title,
  onAdd,
  addDisabled,
  allowNewWorkItems,
  children,
}: {
  title: string;
  onAdd: () => void;
  addDisabled?: boolean;
  /** When provided, the group heading shows a switch for creating new work items in the group. */
  allowNewWorkItems?: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void };
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  return (
    <section className="min-w-0">
      <div className="flex h-9 items-center gap-2 rounded-md bg-layer-1-hover px-2">
        <h4 className="min-w-0 flex-1 truncate px-2 text-13 font-medium text-secondary capitalize">{title}</h4>
        {allowNewWorkItems && (
          <div className={STATE_SWITCH_SLOT_CLASS_NAME}>
            <Tooltip label={t("web.allow_new_work_items_group_hint")} disabled={isMobile}>
              <span className="flex">
                <Switch
                  size="sm"
                  checked={allowNewWorkItems.checked}
                  disabled={allowNewWorkItems.disabled}
                  onCheckedChange={allowNewWorkItems.onChange}
                  aria-label={`${t("web.allow_new_work_items")} · ${title}`}
                />
              </span>
            </Tooltip>
          </div>
        )}
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`${t("common.add")} ${title}`}
          disabled={addDisabled}
          onClick={onAdd}
          icon={<Plus className="size-3.5" />}
        />
      </div>
      <div>{children}</div>
    </section>
  );
}
