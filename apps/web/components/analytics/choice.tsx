import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Select } from "@plane/blocks/select";
import type { ReactElement } from "react";

export function AnalyticsChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  placeholderIcon,
  onClear,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; icon?: ReactElement<{ className?: string; strokeWidth?: number }> }[];
  onChange: (value: T) => void;
  placeholder?: string;
  placeholderIcon?: ReactElement<{ className?: string; strokeWidth?: number }>;
  onClear?: () => void;
}) {
  const { t } = useTranslation();
  const selected = options.find((option) => option.id === value);
  const clearable = !!selected && !!onClear;
  return (
    <Select
      placeholder={selected ? undefined : placeholder}
      getValues={() => options}
      value={options.find((option) => option.id === value) ?? null}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      getOptionIcon={options.some((option) => option.icon) ? (option) => option.icon : undefined}
      onChange={(id) => {
        const option = options.find((item) => item.id === id);
        if (option) onChange(option.id);
      }}
      contentSizing="auto"
      contentMinWidth={90}
      fitOptionLabels
      showSearch={false}
      pinSelected={false}
    >
      <span className="relative inline-flex shrink-0">
        <Tooltip label={`${label}: ${selected?.label ?? placeholder ?? ""}`}>
          <span className="inline-flex">
            <Select.Trigger
              variant="select-md"
              label={label}
              className={clearable ? "w-auto pr-8" : "w-auto"}
              prependIcon={selected?.icon ?? placeholderIcon}
              appendIcon={clearable ? null : undefined}
            >
              {selected?.label ?? placeholder}
            </Select.Trigger>
          </span>
        </Tooltip>
        {clearable && (
          <Tooltip label={t("common.clear")}>
            <button
              type="button"
              aria-label={t("common.clear")}
              className="absolute inset-y-px right-px flex w-7 items-center justify-center rounded-r-md text-tertiary hover:bg-layer-2-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
              onClick={(event) => {
                onClear();
                event.currentTarget.parentElement?.querySelector("button")?.focus();
              }}
            >
              <X className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </span>
    </Select>
  );
}
