import { Children, Fragment, isValidElement, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { SelectDropdownPlacementContext } from "@plane/blocks/select";
import { getPillButtonClassName } from "@plane/blocks/pill-button";
import { useTranslation } from "@plane/i18n";
import { ISSUE_DISPLAY_PROPERTIES } from "@plane/constants";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import type { IWithDisplayPropertiesHOC } from "./with-display-properties-HOC";

const DROPDOWN_PLACEMENT = { side: "left", align: "start" } as const;
type Property = { key: string; content: ReactNode; labelKey?: string };
const PROPERTY_LABEL_KEYS = new Map(
  ISSUE_DISPLAY_PROPERTIES.map(({ key, titleTranslationKey }) => [key, titleTranslationKey])
);

// Resolve the existing display filters before counting or measuring properties. Disabled filters
// and absent count badges consume no space.
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
      ? [
          {
            key: `${child.key}:${keys.join(",")}`,
            content,
            labelKey: PROPERTY_LABEL_KEYS.get(keys[0]),
          },
        ]
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
  const measuredKeys = useRef("");
  const [measurement, setMeasurement] = useState({ keys: "", visibleCount: Infinity });
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const properties = collectProperties(children);
  const count = properties.length;
  const propertyKeys = JSON.stringify(properties.map((property) => property.key));
  // Render all new properties once so their intrinsic widths can be measured before hiding them.
  const visibleCount = measurement.keys === propertyKeys ? measurement.visibleCount : Infinity;

  useLayoutEffect(() => {
    if (measuredKeys.current !== propertyKeys) {
      widths.current = [];
      measuredKeys.current = propertyKeys;
    }
    const setVisibleCount = (nextCount: number) =>
      setMeasurement((previous) =>
        previous.keys === propertyKeys && previous.visibleCount === nextCount
          ? previous
          : { keys: propertyKeys, visibleCount: nextCount }
      );
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
      const nextMeasurement = `${rowWidth}:${direction}:${widths.current.join(",")}`;
      if (nextMeasurement === previousMeasurement) return;
      previousMeasurement = nextMeasurement;
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
  }, [enabled, count, propertyKeys, present]);

  if (!enabled) return <div className={className}>{children}</div>;

  const hiddenCount = Math.max(0, count - visibleCount);
  return (
    <div ref={rootRef} className={className}>
      {properties.map((property, index) => {
        const hidden = index >= visibleCount;
        // A closed overflow keeps its sole control mounted for intrinsic measurement.
        // Opening moves it to the popup; never render two interactive copies.
        if (hidden && present) return null;
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
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            if (nextOpen) setPresent(true);
            setOpen(nextOpen);
          }}
          onOpenChangeComplete={(nextOpen) => {
            if (!nextOpen) setPresent(false);
          }}
        >
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={t("issue.display.properties.more_count", { count: hiddenCount })}
                className={getPillButtonClassName("sm", open, "shrink-0")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            }
          >
            +{hiddenCount}
          </PopoverTrigger>
          <PopoverContent
            aria-label={t("common.properties")}
            side="bottom"
            align="end"
            sideOffset={8}
            onClick={(event) => event.stopPropagation()}
          >
            <SelectDropdownPlacementContext.Provider value={DROPDOWN_PLACEMENT}>
              <div className="flex min-w-56 flex-col gap-3">
                <dl className="grid grid-cols-[minmax(5rem,1fr)_auto] items-center gap-x-6 gap-y-3">
                  {present &&
                    properties.slice(visibleCount).map((property) => (
                      <Fragment key={property.key}>
                        <dt className="text-caption-md-regular text-secondary">
                          {t(property.labelKey ?? "common.properties")}
                        </dt>
                        <dd className="flex min-w-0 items-center justify-end">{property.content}</dd>
                      </Fragment>
                    ))}
                </dl>
              </div>
            </SelectDropdownPlacementContext.Provider>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
});
