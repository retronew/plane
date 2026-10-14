import type { ReactNode } from "react";
/** Shared state title/description layout for project and workspace settings. */
export function StateSummary({
  icon,
  name,
  description,
  badge,
}: {
  icon?: ReactNode;
  name: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1 px-1">
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-h-5 min-w-0 px-2 text-13">
        <span className="flex items-center gap-2 font-medium">
          <span className="truncate">{name}</span>
          {badge}
        </span>
        {description && <span className="font-normal block truncate text-11 text-secondary">{description}</span>}
      </span>
    </span>
  );
}
