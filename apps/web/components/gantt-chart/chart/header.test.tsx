import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GanttChartHeader } from "./header";
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-timeline-chart", () => ({ useTimeLineChartStore: () => ({ currentView: "week" }) }));
it("switches Gantt scale and full-screen through the shared native controls", () => {
  const scale = vi.fn(),
    full = vi.fn();
  render(
    <GanttChartHeader
      blockIds={["one"]}
      fullScreenMode={false}
      handleChartView={scale}
      handleToday={vi.fn()}
      loaderTitle="Projects"
      toggleFullScreenMode={full}
      showToday={false}
    />
  );
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("tab")[1]);
  expect(scale).toHaveBeenCalledWith("month");
  fireEvent.click(screen.getByRole("button", { name: "common.full_screen" }));
  expect(full).toHaveBeenCalledOnce();
  expect(screen.queryByText("common.today")).toBeNull();
});
