import type { ReactNode } from "react";
import { ComboboxChip } from "@makeplane/propel/elements/combobox";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

export function ProjectFilterChip({
  label,
  icon,
  onRemove,
}: {
  label: string;
  icon?: ReactNode;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ComboboxChip
      size="xs"
      render={(props) => <div {...props} className={cn(props.className, "border-none bg-layer-3")} />}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate normal-case">{label}</span>
      {onRemove && (
        <IconButton
          variant="ghost"
          size="xs"
          icon={<CloseOutline />}
          aria-label={`${t("remove")} ${label}`}
          onClick={onRemove}
        />
      )}
    </ComboboxChip>
  );
}
