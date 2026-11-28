import type { ComponentProps } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { FilterOutline, SelectedFilterOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";

type Props = Omit<ComponentProps<typeof IconButton>, "variant" | "icon" | "render"> & {
  active: boolean;
  count?: number;
};

/** One active treatment for project, work-item and saved-view filter controls. */
export function FilterToggleButton({ active, count, className, ...props }: Props) {
  const showCount = typeof count === "number" && count > 0;
  return (
    <IconButton
      {...props}
      variant="secondary"
      icon={active ? <SelectedFilterOutline className="size-4" /> : <FilterOutline className="size-4" />}
      render={(buttonProps) => (
        <button
          {...buttonProps}
          className={cn(
            buttonProps.className,
            className,
            active && "border-accent-strong! bg-accent-subtle! text-accent-primary!",
            showCount && "w-auto! gap-1.5 px-2!"
          )}
        >
          {buttonProps.children}
          {showCount && (
            <span className="text-caption-md-medium leading-none tabular-nums" data-filter-count="">
              {count}
            </span>
          )}
        </button>
      )}
    />
  );
}
