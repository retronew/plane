import { cleanup, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CycleTooltip } from "./cycle-chart";

const language = vi.hoisted(() => ({ current: "en" }));

vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => language.current,
  useTranslation: () => ({ t: (key: string) => key }),
}));

it("omits the range-fill payload and invalid values from the tooltip", () => {
  render(
    <CycleTooltip
      active
      burnup={false}
      label={Date.parse("2026-10-16")}
      payload={[
        { graphicalItemId: "ideal", dataKey: "ideal", value: 10.266666 },
        // Recharts includes range-area values in the runtime tooltip payload.
        { graphicalItemId: "difference", dataKey: "difference", value: [10.266666, 19] },
        { graphicalItemId: "actual", dataKey: "actual", value: 19 },
        { graphicalItemId: "started", dataKey: "started", value: Number.NaN },
      ]}
    />
  );
  expect(screen.getByText("workspace_cycles.ideal_pending_series")).toBeTruthy();
  expect(screen.getByText("10.27")).toBeTruthy();
  expect(screen.getByText("19")).toBeTruthy();
  expect(screen.queryByText("workspace_cycles.started")).toBeNull();
  expect(screen.queryByText("NaN")).toBeNull();
});

it("updates cached tooltip dates when the language switches and keeps UTC date boundaries", () => {
  cleanup();
  const timestamp = Date.parse("2026-01-01T00:05:00Z");
  const props = {
    active: true,
    burnup: false,
    label: timestamp,
    payload: [{ graphicalItemId: "actual", dataKey: "actual", value: 1 }],
  };
  language.current = "en";
  const view = render(<CycleTooltip {...props} />);
  expect(
    screen.getByText(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(timestamp))
  ).toBeTruthy();
  language.current = "zh-CN";
  view.rerender(<CycleTooltip {...props} />);
  expect(
    screen.getByText(new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "UTC" }).format(timestamp))
  ).toBeTruthy();
  language.current = "en";
  view.rerender(<CycleTooltip {...props} />);
  expect(screen.getByText("Jan 1, 2026")).toBeTruthy();
});
