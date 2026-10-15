import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BlockRow } from "./block-row";
const { block } = vi.hoisted(() => ({
  block: { id: "test", data: { id: "test" }, start_date: "2026-10-15", target_date: "2026-10-20" },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../helpers", () => ({ ChartAddBlock: () => null }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => ({ getIsIssuePeeked: () => false }) }));
vi.mock("@/hooks/use-timeline-chart", () => ({
  useTimeLineChartStore: () => ({
    getBlockById: () => block,
    updateActiveBlockId: vi.fn(),
    isBlockActive: () => false,
  }),
}));
it("updates the jump direction when a fast scroll skips the visible range", () => {
  let right = 1200;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return {
      left: 0,
      right: this.id === "gantt-block-test" ? right : 800,
      top: 0,
      bottom: 44,
      width: 800,
      height: 44,
      x: 0,
      y: 0,
      toJSON() {},
    };
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              isIntersecting: false,
              target,
              boundingClientRect: { right: 1200 },
              rootBounds: { left: 360 },
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
  const jump = vi.fn();
  const props = {
    blockId: "test",
    showAllBlocks: true,
    blockUpdateHandler: vi.fn(),
    handleScrollToBlock: jump,
    enableAddBlock: false,
    selectionHelpers: {
      getIsEntitySelected: () => false,
      getIsEntityActive: () => false,
      handleClearSelection: vi.fn(),
      handleEntityClick: vi.fn(),
      handleGroupClick: vi.fn(),
      isGroupSelected: () => "empty",
      isSelectionDisabled: false,
    },
    ganttContainerRef: { current: null },
  } satisfies ComponentProps<typeof BlockRow>;
  const { unmount } = render(
    <div id="gantt-container">
      <div id="gantt-block-test" />
      <BlockRow {...props} />
    </div>
  );
  expect(screen.getByRole("button", { name: "web.ui.gantt_jump_right" })).toBeTruthy();
  right = -200;
  fireEvent.scroll(document.querySelector("#gantt-container")!);
  fireEvent.click(screen.getByRole("button", { name: "web.ui.gantt_jump_left" }));
  expect(jump).toHaveBeenCalledWith(block);
  unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
