import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CustomTooltip } from "./tooltip";
import { CustomPieChartTooltip } from "../pie-chart/tooltip";
import { TreeMapTooltip } from "../tree-map/tooltip";
const config = {
  active: true,
  label: "October",
  itemKeys: ["created", "done"],
  itemLabels: { created: "Created", done: "Done" },
  itemDotColors: { created: "purple", done: "green" },
};
it("keeps declared series order, formats zero and decimals, and suppresses duplicate/foreign payloads", () => {
  render(
    <CustomTooltip
      {...config}
      payload={[
        { graphicalItemId: "series", dataKey: "done", value: 0 },
        { graphicalItemId: "series", dataKey: "created", value: 1234.567 },
        { graphicalItemId: "series", dataKey: "created", value: 12 },
        { graphicalItemId: "series", dataKey: "other", value: 999 },
      ]}
    />
  );
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.textContent).toContain("Created1,234.57Done0");
  expect(screen.getAllByText("Created")).toHaveLength(1);
  expect(screen.queryByText("999")).toBeNull();
});
it("uses fallback labels and ignores null values without hiding numeric zeros", () => {
  const { rerender } = render(
    <CustomTooltip
      {...config}
      itemLabels={{}}
      payload={[
        { graphicalItemId: "series", dataKey: "created", name: "Custom label", value: 0 },
        { graphicalItemId: "series", dataKey: "done", value: undefined },
      ]}
    />
  );
  expect(screen.getByText("Custom label")).toBeTruthy();
  expect(screen.getByText("0")).toBeTruthy();
  rerender(
    <CustomTooltip {...config} active={false} payload={[{ graphicalItemId: "series", dataKey: "created", value: 1 }]} />
  );
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("shares the same accessible content for pie and treemap tooltips", () => {
  const { rerender } = render(
    <CustomPieChartTooltip
      label="State"
      dotColor="green"
      payload={[{ graphicalItemId: "series", dataKey: "value", name: "Done", value: 0 }]}
    />
  );
  expect(screen.getByRole("tooltip").textContent).toBe("StateDone0");
  rerender(
    <TreeMapTooltip
      active
      payload={[{ graphicalItemId: "series", payload: { name: "Core", label: "Work items", value: 1200 } }]}
    />
  );
  expect(screen.getByRole("tooltip").textContent).toBe("CoreWork items1,200");
  rerender(<TreeMapTooltip active={false} payload={[]} />);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
