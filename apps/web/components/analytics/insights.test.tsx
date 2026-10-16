import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { Insights } from "./insights";
vi.mock("./choice", () => ({
  AnalyticsChoice: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("./work-items/priority-chart", () => ({ default: () => <div>Work item results</div> }));
vi.mock("./entity-insights", () => ({
  EntityInsights: ({ metric, axis, group }: { metric: string; axis: string; group?: string }) => (
    <output>
      {metric}:{axis}:{group || "none"}
    </output>
  ),
}));
beforeEach(() => setLanguage("zh-CN"));
it("uses exactly three controls and clears incompatible dimensions when changing the first metric", () => {
  render(<Insights />);
  expect(screen.getAllByRole("combobox")).toHaveLength(3);
  fireEvent.change(screen.getByRole("combobox", { name: "细分维度" }), { target: { value: "ASSIGNEES" } });
  fireEvent.change(screen.getByRole("combobox", { name: "统计指标" }), { target: { value: "users" } });
  expect(screen.getByRole("status").textContent).toBe("users:STATE_GROUPS:none");
  expect(screen.queryByText("Work item results")).toBeNull();
  expect(screen.queryByRole("option", { name: "优先级" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "分组维度" }), { target: { value: "ASSIGNEES" } });
  fireEvent.change(screen.getByRole("combobox", { name: "细分维度" }), { target: { value: "STATE_GROUPS" } });
  expect(screen.getByRole("status").textContent).toBe("users:ASSIGNEES:STATE_GROUPS");
  fireEvent.change(screen.getByRole("combobox", { name: "统计指标" }), { target: { value: "work-items" } });
  expect(screen.getByText("Work item results")).toBeDefined();
  expect((screen.getByRole("combobox", { name: "分组维度" }) as HTMLSelectElement).value).toBe("PRIORITY");
});
