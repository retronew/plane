import { useLayoutEffect, useRef } from "react";
import type { ComponentProps } from "react";
import { Tabs } from "@makeplane/propel/components/tabs";
import { cn } from "@plane/utils";
import styles from "./animated-underline-tabs.module.css";

const previousValues = new Map<string, unknown>();
type Props = Omit<ComponentProps<typeof Tabs>, "variant"> & {
  className?: string;
  motionKey?: string;
  fillHeight?: boolean;
  animatePanels?: boolean;
};

/** Shared moving background and underline, including route tabs whose headers remount. */
export function AnimatedUnderlineTabs({
  className,
  motionKey,
  value,
  fillHeight = false,
  animatePanels = true,
  ...props
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastSelection = useRef({ key: motionKey, value: motionKey ? previousValues.get(motionKey) : undefined });
  useLayoutEffect(() => {
    if (!motionKey) return;
    if (lastSelection.current.key !== motionKey)
      lastSelection.current = { key: motionKey, value: previousValues.get(motionKey) };
    const previous = lastSelection.current.value;
    previousValues.delete(motionKey);
    previousValues.set(motionKey, value);
    if (previousValues.size > 64) previousValues.delete(previousValues.keys().next().value!);
    if (previous == null || previous === value || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lastSelection.current.value = value;
      return;
    }
    let animation: Animation | undefined;
    let resize: ResizeObserver | undefined;
    const frame = requestAnimationFrame(() => {
      lastSelection.current.value = value;
      const list = ref.current?.querySelector('[role="tablist"]');
      const tabs = [...(list?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
      const from = tabs.find((tab) => tab.dataset.motionValue === String(previous));
      const to = tabs.find((tab) => tab.dataset.motionValue === String(value));
      const indicator = list?.querySelector<HTMLElement>(':scope > [role="presentation"]');
      const fromBar = from?.lastElementChild?.firstElementChild?.getBoundingClientRect();
      const toBar = to?.lastElementChild?.firstElementChild?.getBoundingClientRect();
      if (!list || !indicator || !to || !fromBar?.width || !toBar?.width) return;
      const geometry = (bar: DOMRect) => {
        const origin = list.getBoundingClientRect();
        return {
          left: `${bar.left - origin.left + list.scrollLeft}px`,
          top: `${bar.top - origin.top + list.scrollTop}px`,
          width: `${bar.width}px`,
        };
      };
      const style = getComputedStyle(ref.current!);
      // Route headers can remount before Base UI has finished measuring its active tab.
      // Own the final geometry while using WAAPI; native CSS transitions must not run a second slide.
      indicator.style.transition = "none";
      const pinDestination = () => {
        const bar = to.lastElementChild?.firstElementChild?.getBoundingClientRect();
        if (!bar?.width) return;
        Object.assign(indicator.style, geometry(bar));
      };
      pinDestination();
      resize = new ResizeObserver(pinDestination);
      resize.observe(list);
      resize.observe(to);
      animation = indicator.animate([geometry(fromBar), geometry(toBar)], {
        duration: parseFloat(style.getPropertyValue("--tabs-duration")),
        easing: style.getPropertyValue("--tabs-easing").trim(),
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      animation?.cancel();
    };
  }, [motionKey, value]);
  return (
    <div
      ref={ref}
      className={cn(
        "w-full max-w-full min-w-0",
        styles.tabs,
        !animatePanels && styles.asyncPanels,
        fillHeight && styles.fillHeight,
        className
      )}
    >
      <Tabs {...props} variant="underline" value={value} />
    </div>
  );
}
