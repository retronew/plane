import { ChartTooltipContent } from "@plane/blocks/charts";
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
  if (value == null) return null;
  return <ChartTooltipContent rows={[{ key: "value", label, value, color }]} />;
}
