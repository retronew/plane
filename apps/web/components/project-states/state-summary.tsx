import type { ReactNode } from "react";
import { StateIconFrame } from "./state-icon-frame";
/** Shared state title/description layout for project and workspace settings. */
export function StateSummary({
  icon,
  name,
  description,
  badge,
  color,
}: {
  icon?: ReactNode;
  name: string;
  description?: string;
  badge?: ReactNode;
  color?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {icon && <StateIconFrame color={color}>{icon}</StateIconFrame>}
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-body-sm-medium leading-5 text-primary">
          <span className="truncate">{name}</span>
          {badge}
        </span>
        {description && (
          <span className="font-normal block truncate text-12 leading-4 text-tertiary">{description}</span>
        )}
      </span>
    </span>
  );
}
