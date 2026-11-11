import { useRef, useState } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { MenuPanel } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { TFilterValue, TNumberFilterFieldConfig } from "@plane/types";
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME } from "../shared";

export function NumberFilterValueInput({
  value,
  config,
  disabled,
  onChange,
}: {
  value: TFilterValue | TFilterValue[];
  config: TNumberFilterFieldConfig;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const current = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const [open, setOpen] = useState(!current && !disabled);
  const [draft, setDraft] = useState(current);
  const number = Number(draft);
  const valid =
    draft.trim() !== "" &&
    Number.isFinite(number) &&
    (config.min === undefined || number >= config.min) &&
    (config.max === undefined || number <= config.max);

  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(current);
      }}
    >
      <BasePopover.Trigger
        disabled={disabled}
        aria-label={config.label}
        className={`h-full max-w-60 truncate px-2 text-body-xs-regular text-secondary outline-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong ${COMMON_FILTER_ITEM_BORDER_CLASSNAME}`}
      >
        {current ? `${current} ${config.unitLabel ?? ""}`.trim() : "--"}
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={4} className="z-60">
          <BasePopover.Popup initialFocus={inputRef} aria-label={config.label} render={<MenuPanel className="w-72" />}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!valid) return;
                onChange(number);
                setOpen(false);
              }}
              className="space-y-3 p-3"
            >
              <InputGroup size="md">
                <Input
                  ref={inputRef}
                  size="md"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={config.min}
                  max={config.max}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label={config.label}
                />
                {config.unitLabel && (
                  <span className="shrink-0 text-body-xs-regular text-secondary">{config.unitLabel}</span>
                )}
              </InputGroup>
              {config.description && <p className="text-body-xs-regular text-tertiary">{config.description}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" stretch="auto" onClick={() => setOpen(false)} label={t("cancel")} />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  stretch="auto"
                  disabled={!valid}
                  label={t("common.apply")}
                />
              </div>
            </form>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
