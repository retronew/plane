import { useEffect, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { Check } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { cn, hexToHsl, hslToHex } from "@plane/utils";

export const ICON_PRESET_COLORS = [
  "#a2a6ac",
  "#95a2b3",
  "#5e6ad2",
  "#26b5ce",
  "#4cb782",
  "#f0bf00",
  "#e78f41",
  "#c79b94",
  "#eb5757",
];
export function IconColorPanel({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => !ICON_PRESET_COLORS.includes(color.toLowerCase()) && color !== "#6d7b8a");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector(".react-colorful__saturation [role=slider]")
      ?.setAttribute("aria-label", t("web.icon_color.saturation"));
    const builtInHue = ref.current?.querySelector(".react-colorful__hue");
    builtInHue?.setAttribute("aria-hidden", "true");
    builtInHue?.querySelector("[role=slider]")?.setAttribute("tabindex", "-1");
  }, [t]);
  return (
    <div ref={ref} data-icon-color-panel="" className="border-t border-subtle px-4 py-2">
      <div className="flex h-8 items-center gap-3">
        {custom ? (
          <div key="custom" data-color-mode-content="" className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="grid size-[22px] shrink-0 place-items-center rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              <Check size={12} />
            </span>
            <span className="text-12 text-tertiary">HEX</span>
            <HexColorInput
              color={color}
              onChange={onChange}
              prefixed
              aria-label={t("aria_labels.color_picker.hex_input")}
              className="h-7 min-w-0 flex-1 rounded-sm bg-transparent text-12 text-secondary outline-none focus-visible:ring-1 focus-visible:ring-accent-strong"
            />
          </div>
        ) : (
          <div
            key="presets"
            data-color-mode-content=""
            className="flex min-w-0 flex-1 items-center justify-between gap-1"
          >
            {ICON_PRESET_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                aria-label={value}
                aria-pressed={color.toLowerCase() === value}
                onClick={() => onChange(value)}
                style={{ backgroundColor: value }}
                className="grid size-[22px] shrink-0 place-items-center rounded-full text-white outline-none hover:ring-2 hover:ring-accent-strong hover:ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                {color.toLowerCase() === value && <Check size={12} />}
              </button>
            ))}
          </div>
        )}
        <div className={cn("flex shrink-0 items-center", !custom && "border-l border-subtle pl-3")}>
          <button
            type="button"
            aria-label={t(custom ? "web.icon_color.presets" : "web.icon_color.custom")}
            title={t(custom ? "web.icon_color.presets" : "web.icon_color.custom")}
            aria-pressed={custom}
            onClick={() => setCustom(!custom)}
            className={cn(
              "size-[22px] rounded-full outline-none conical-gradient focus-visible:ring-2 focus-visible:ring-accent-strong",
              custom && "ring-offset-layer-2 ring-2 ring-accent-strong ring-offset-2"
            )}
          />
        </div>
      </div>
      <div data-color-mode-drawer="" data-open={custom ? "" : undefined} aria-hidden={!custom} inert={!custom}>
        <div className="min-h-0 overflow-hidden">
          <div className="relative pt-3">
            <HexColorPicker color={color} onChange={onChange} />
            <input
              data-icon-hue=""
              type="range"
              min={0}
              max={360}
              value={hexToHsl(color).h}
              aria-label={t("web.icon_color.hue")}
              aria-orientation="vertical"
              onChange={(event) => onChange(hslToHex({ ...hexToHsl(color), h: Number(event.target.value) }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
