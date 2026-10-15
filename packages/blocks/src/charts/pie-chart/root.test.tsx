import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PieChart } from "./root";

const tooltip = vi.hoisted(() => ({
  active: true,
  label: "Work",
  payload: [{ name: "Done", value: 3, payload: { key: "done" } }],
}));
vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: ({ content }: { content: (props: typeof tooltip) => ReactNode }) => <>{content(tooltip)}</>,
}));
vi.mock("../components/responsive-container", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./tooltip", () => ({ CustomPieChartTooltip: ({ label }: { label: string }) => <p>{label}</p> }));
const props = {
  data: [{ key: "done", value: 3 }],
  cells: [{ key: "done", fill: "green" }],
  dataKey: "value",
  showLabel: false,
};
beforeEach(() => {
  tooltip.active = true;
});
it("allows a custom tooltip to receive the real active payload", () => {
  const custom = vi.fn(({ payload }: { payload: typeof tooltip.payload }) => <p>Count: {payload[0].value}</p>);
  render(<PieChart {...props} customTooltipContent={custom} />);
  expect(screen.getByText("Count: 3")).toBeTruthy();
  expect(custom).toHaveBeenCalledWith(tooltip);
});
it("preserves the default tooltip for other chart consumers", () => {
  render(<PieChart {...props} tooltipLabel="Total" />);
  expect(screen.getByText("Total")).toBeTruthy();
});
it("does not invoke custom content when inactive or disabled", () => {
  const custom = vi.fn(() => <p>Custom</p>);
  tooltip.active = false;
  const { rerender } = render(<PieChart {...props} customTooltipContent={custom} />);
  tooltip.active = true;
  rerender(<PieChart {...props} customTooltipContent={custom} showTooltip={false} />);
  expect(custom).not.toHaveBeenCalled();
});
