import { Link } from "react-router";
import { Tooltip } from "@makeplane/propel/components/tooltip";

export function AnalyticsMetricCard({
  label,
  count,
  hint,
  to,
  unit = "",
}: {
  label: string;
  count: number;
  hint: string;
  to: string;
  unit?: string;
}) {
  return (
    <Tooltip label={hint}>
      <Link
        to={to}
        onClick={
          to.startsWith("#")
            ? (event) => {
                event.preventDefault();
                document.getElementById(to.slice(1))?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  block: "start",
                });
              }
            : undefined
        }
        className="group flex flex-col gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-accent-strong"
      >
        <span className="text-12 text-tertiary">{label}</span>
        <span className="text-24 font-medium text-primary tabular-nums">
          {count.toLocaleString()}
          {unit}
        </span>
      </Link>
    </Tooltip>
  );
}
