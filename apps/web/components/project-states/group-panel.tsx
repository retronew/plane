import type { ReactNode } from "react";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { AddOutline, ChevronDownOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

/** Shared state-group chrome; project/workspace adapters own persistence and group semantics. */
export function StateGroupPanel({
  open,
  onOpenChange,
  title,
  icon,
  onAdd,
  addDisabled,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: ReactNode;
  onAdd: () => void;
  addDisabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      indicator={false}
      icon={<Icon icon={<ChevronDownOutline className={cn("transition-transform", !open && "-rotate-90")} />} />}
      trigger={
        <span className="flex w-full items-center gap-1">
          {icon}
          <span className="px-1 text-14 font-medium text-secondary capitalize">{title}</span>
        </span>
      }
      trailing={
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${t("common.add")} ${title}`}
          disabled={addDisabled}
          onClick={onAdd}
          icon={<Icon icon={AddOutline} />}
        />
      }
    >
      {children}
    </Collapsible>
  );
}
