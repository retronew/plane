import { Circle, Tag } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@makeplane/propel/components/popover";
import { ColorSwatchPicker } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";

export function CategoryColorPicker({
  value,
  onChange,
  disabled,
  kind = "label",
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  kind?: "label" | "status";
}) {
  const { t } = useTranslation();
  const Icon = kind === "label" ? Tag : Circle;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={t("aria_labels.color_picker.open")}
            className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-layer-2 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
          >
            <Icon className="size-4" style={{ color: value }} />
          </button>
        }
      />
      <PopoverContent variant="rich" side="bottom" align="start">
        <ColorSwatchPicker className="w-88" value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
