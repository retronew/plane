import type { ComponentProps } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { FilterOutline, SelectedFilterOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";

type Props = Omit<ComponentProps<typeof IconButton>, "variant" | "icon" | "render"> & {
  active: boolean;
  count?: number;
  /** Render the visual chrome as a `<span>` when hosted inside an outer native `<button>` trigger (e.g. BasePopover.Trigger). */
  renderAsSpan?: boolean;
};

/** One active treatment for project, work-item and saved-view filter controls. */
export function FilterToggleButton({ active, count, className, renderAsSpan = false, ...props }: Props) {
  const showCount = typeof count === "number" && count > 0;
  return (
    <IconButton
      {...props}
      variant="secondary"
      icon={active ? <SelectedFilterOutline className="size-4" /> : <FilterOutline className="size-4" />}
      render={(buttonProps) => {
        const mergedClassName = cn(
          buttonProps.className,
          className,
          active && "border-accent-strong! bg-accent-subtle! text-accent-primary!",
          showCount && "w-auto! gap-1.5 px-2!"
        );
        const content = (
          <>
            {buttonProps.children}
            {showCount && (
              <span className="text-caption-md-medium leading-none tabular-nums" data-filter-count="">
                {count}
              </span>
            )}
          </>
        );
        if (renderAsSpan) {
          return <span className={mergedClassName}>{content}</span>;
        }
        return (
          <button {...buttonProps} className={mergedClassName}>
            {content}
          </button>
        );
      }}
    />
  );
}
