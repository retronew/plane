import { Children, Fragment, isValidElement, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { SelectDropdownPlacementContext } from "@plane/blocks/select";
import { getPillButtonClassName } from "@plane/blocks/pill-button";
import { useTranslation } from "@plane/i18n";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import type { IWithDisplayPropertiesHOC } from "./with-display-properties-HOC";

const DROPDOWN_PLACEMENT = { side: "left", align: "start" } as const;
type Property = { key: string; content: ReactNode };

// Resolve the existing display filters before counting or measuring properties. A merged date
// range is one property; disabled filters and absent count badges consume no space.
function collectProperties(children: ReactNode): Property[] {
  return Children.toArray(children).flatMap((child): Property[] => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) return collectProperties((child.props as { children: ReactNode }).children);
    if (child.type !== WithDisplayPropertiesHOC) return [{ key: String(child.key), content: child }];
    const {
      displayProperties,
      displayPropertyKey,
      shouldRenderProperty,
      children: content,
    } = child.props as IWithDisplayPropertiesHOC;
    const keys = Array.isArray(displayPropertyKey) ? displayPropertyKey : [displayPropertyKey];
    return keys.every((key) => displayProperties[key]) &&
      (!shouldRenderProperty || shouldRenderProperty(displayProperties))
      ? [{ key: `${child.key}:${keys.join(",")}`, content }]
      : [];
  });
}

export const ListPropertiesOverflow = observer(function ListPropertiesOverflow({
  children,
  className,
  enabled,
}: {
  children: ReactNode;
  className: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const widths = useRef<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(Infinity);
  const [open, setOpen] = useState(false);
  const properties = collectProperties(children);
  const count = properties.length;
  const propertyKeys = JSON.stringify(properties.map((property) => property.key));

  useLayoutEffect(() => {
    const root = rootRef.current;
    const row = root?.closest<HTMLElement>("[data-issue-list-row]");
    if (!enabled || !root || !row) return;
    let previousMeasurement = "";
    const measure = () => {
      root.querySelectorAll<HTMLElement>("[data-list-property]").forEach((element) => {
        const index = Number(element.dataset.listProperty);
        const width = element.getBoundingClientRect().width;
        if (width > 0) widths.current[index] = width;
      });
      const rowWidth = row.getBoundingClientRect().width;
      const direction = getComputedStyle(row).flexDirection;
      const measurement = `${rowWidth}:${direction}:${widths.current.join(",")}`;
      if (measurement === previousMeasurement) return;
      previousMeasurement = measurement;
      if (!rowWidth || direction !== "row") {
        setVisibleCount(Infinity);
        return;
      }
      // Keep a readable title and space for the row's quick actions. Reserve +N only
      // when needed, and retain the leading properties (state/priority) first.
      const budget = Math.max(0, rowWidth - Math.max(320, rowWidth / 2) - 44);
      const total = Array.from({ length: count }).reduce<number>(
        (sum, _, index) => sum + (widths.current[index] ?? 0) + 8,
        -8
      );
      if (total <= budget) {
        setVisibleCount(Infinity);
        return;
      }
      let used = 36;
      let visible = 0;
      for (let index = 0; index < count; index++) {
        const width = widths.current[index] ?? 0;
        if (used + width + 8 > budget) break;
        used += width + 8;
        visible++;
      }
      setVisibleCount(visible);
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(row);
    root.querySelectorAll<HTMLElement>("[data-list-property]").forEach((element) => resizeObserver.observe(element));
    return () => resizeObserver.disconnect();
  }, [enabled, count, propertyKeys, open]);

  if (!enabled) return <div className={className}>{children}</div>;

  const hiddenCount = Math.max(0, count - visibleCount);
  return (
    <div ref={rootRef} className={className}>
      {properties.map((property, index) => {
        const hidden = index >= visibleCount;
        // A closed overflow keeps its sole control mounted for intrinsic measurement.
        // Opening moves it to the popup; never render two interactive copies.
        if (hidden && open) return null;
        return (
          <div
            key={property.key}
            data-list-property={index}
            className={hidden ? "pointer-events-none invisible absolute w-max" : "w-max shrink-0"}
            inert={hidden || undefined}
            aria-hidden={hidden || undefined}
          >
            {property.content}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={t("issue.display.properties.more_count", { count: hiddenCount })}
                className={getPillButtonClassName("sm", open, "h-6 shrink-0 rounded-md")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            }
          >
            +{hiddenCount}
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={8} onClick={(event) => event.stopPropagation()}>
            <SelectDropdownPlacementContext.Provider value={DROPDOWN_PLACEMENT}>
              <div className="flex flex-col items-start gap-3">
                <div className="text-caption-md-medium text-secondary">{t("common.properties")}</div>
                {open &&
                  properties.slice(visibleCount).map((property) => <div key={property.key}>{property.content}</div>)}
              </div>
            </SelectDropdownPlacementContext.Provider>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
});
