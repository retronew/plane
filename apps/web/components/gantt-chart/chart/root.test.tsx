import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChartViewRoot } from "./root";

const mocks = vi.hoisted(() => ({
  content: {} as Record<string, any>,
  generateChart: vi.fn(),
  store: {
    currentView: "week",
    currentViewData: { key: "week" },
    renderView: [],
    updateCurrentView: vi.fn(),
    updateCurrentViewData: vi.fn(),
    updateRenderView: vi.fn(),
    updateAllBlocksOnChartChangeWhileDragging: vi.fn(),
  },
}));
vi.mock("@/hooks/use-timeline-chart", () => ({ useTimeLineChartStore: () => mocks.store }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: {} }) }));
vi.mock("@/components/gantt-chart", () => ({
  GanttChartHeader: () => null,
  GanttChartMainContent: (props: Record<string, any>) => {
    mocks.content = props;
    return <div id="gantt-container" />;
  },
}));
vi.mock("../views", () => {
  const view = { generateChart: mocks.generateChart, mergeRenderPayloads: () => [] };
  return { weekView: view, monthView: view, quarterView: view, getNumberOfDaysBetweenTwoDates: () => 1 };
});
vi.mock("../data", () => ({ currentViewDataWithView: () => ({ key: "month" }) }));

const props = {
  border: false,
  title: "Timeline",
  loaderTitle: "Loading",
  blockIds: [],
  blockUpdateHandler: vi.fn(),
  blockToRender: () => null,
  sidebarToRender: () => null,
  enableBlockLeftResize: false,
  enableBlockRightResize: false,
  enableBlockMove: false,
  enableReorder: false,
  enableAddBlock: false,
  enableSelection: false,
  enableDependency: false,
  bottomSpacing: false,
  showAllBlocks: false,
  showToday: false,
};
afterEach(() => vi.useRealTimers());

it("accumulates batched extensions on either side without replacing the existing width", () => {
  mocks.generateChart.mockReturnValue({
    payload: [],
    scrollWidth: 100,
    state: { data: { currentDate: new Date(), dayWidth: 10 } },
  });
  render(<ChartViewRoot {...props} />);
  expect(mocks.content.itemsContainerWidth).toBe(100);
  act(() => {
    mocks.content.updateCurrentViewRenderPayload("left", "week");
    mocks.content.updateCurrentViewRenderPayload("right", "week");
  });
  expect(mocks.content.itemsContainerWidth).toBe(300);
});

it("cancels superseded and unmounted delayed scrolling", () => {
  vi.useFakeTimers();
  mocks.generateChart.mockReturnValue({
    payload: [],
    scrollWidth: 100,
    state: { data: { currentDate: new Date(), dayWidth: 10 } },
  });
  const view = render(<ChartViewRoot {...props} />);
  expect(vi.getTimerCount()).toBe(1);
  act(() => mocks.content.updateCurrentViewRenderPayload(null, "month"));
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
