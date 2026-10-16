import type { ReactNode } from "react";
import { Link } from "react-router";
import { Tooltip } from "@makeplane/propel/components/tooltip";

/** Keep entity icons, truncation, full labels and navigation consistent across analytics tables. */
export function AnalyticsEntityCell({ name, href, icon }: { name: string; href?: string; icon?: ReactNode }) {
  const content = (
    <>
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="truncate">{name}</span>
    </>
  );
  return (
    <Tooltip label={name}>
      {href ? (
        <Link
          to={href}
          className="flex max-w-64 items-center gap-2 rounded-sm hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          {content}
        </Link>
      ) : (
        <span className="flex max-w-64 items-center gap-2">{content}</span>
      )}
    </Tooltip>
  );
}
