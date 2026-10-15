export type ProfileChartTooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly {
    name?: string | number;
    value?: string | number;
    payload: { key?: string; color?: string };
  }[];
};

type Props = {
  label?: string | number;
  value?: string | number;
  color?: string;
};

export function ProfileChartTooltip({ label, value, color }: Props) {
  return (
    <div
      role="tooltip"
      className="flex max-w-48 min-w-24 items-center gap-2 rounded-md border border-subtle-1 bg-layer-2 px-2.5 py-2 text-12 shadow-raised-100"
    >
      {color && <span className="size-1.5 shrink-0 rounded-xs" style={{ backgroundColor: color }} />}
      <span className="min-w-0 flex-1 truncate text-secondary">{label}</span>
      <span className="shrink-0 font-medium text-primary">{value}</span>
    </div>
  );
}
