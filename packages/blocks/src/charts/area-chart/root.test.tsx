import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AreaChart } from "./root";
const state = vi.hoisted(() => ({ active: false, label: undefined as number | undefined }));
vi.mock("recharts", () => ({
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  Legend: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }: { content: (props: unknown) => ReactNode }) => (
    <>{content({ ...state, payload: state.active ? [{ value: 2 }] : [] })}</>
  ),
}));
vi.mock("../components/responsive-container", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../components/tooltip", () => ({ CustomTooltip: ({ label }: { label: string }) => <p>{label}</p> }));
it("does not format an absent inactive tooltip date and formats active timestamps", () => {
  const formatter = vi.fn((value: number) => new Date(value).toISOString().slice(0, 10));
  const props = {
    data: [{ timestamp: Date.parse("2026-10-16"), count: 2 }],
    areas: [],
    xAxis: { key: "timestamp", tickFormatter: formatter },
    yAxis: { key: "count" },
  };
  state.active = false;
  state.label = undefined;
  const { rerender } = render(<AreaChart {...props} />);
  expect(formatter).not.toHaveBeenCalled();
  state.active = true;
  state.label = Date.parse("2026-10-16");
  rerender(<AreaChart {...props} data={[...props.data]} />);
  expect(screen.getByText("2026-10-16")).toBeTruthy();
});
