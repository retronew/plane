import { createRef, useEffect } from "react";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { IIssueMap } from "@plane/types";
import { getIssueBlockId } from "../utils";
import { KanbanIssueBlocksList } from "./blocks-list";
import { DeferredKanbanColumn } from "./deferred-column";

const mounted = vi.fn();
vi.mock("./block", () => ({
  KanbanIssueBlock: ({ issueId, index, draggableId }: { issueId: string; index: number; draggableId: string }) => {
    useEffect(() => {
      mounted(issueId);
    }, [issueId]);
    return (
      <article data-index={index} data-sortable={draggableId}>
        <a href="#issue" id={getIssueBlockId(issueId, "priority", "null")}>
          {issueId}
        </a>
        <input aria-label={`Edit ${issueId}`} />
      </article>
    );
  },
}));

function listProps(count: number, prefix = "card") {
  const issueIds = Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
  return {
    sub_group_id: "null",
    groupId: "priority",
    columnId: "priority",
    activeIssueId: null,
    activeSourceColumnId: null,
    issuesMap: Object.fromEntries(issueIds.map((id) => [id, { id, name: id }])) as IIssueMap,
    issueIds,
    displayProperties: {},
    updateIssue: undefined,
    quickActions: () => <></>,
    canEditProperties: () => true,
    canDragIssuesInCurrentGrouping: true,
  } satisfies ComponentProps<typeof KanbanIssueBlocksList>;
}

// jsdom has no layout. Clip 336px columns against the board and rows against the column,
// using the options supplied by the component. An explicit column root skips board clipping.
function viewport() {
  const observers = new Set<ColumnObserver>();
  class ColumnObserver {
    rows = new Set<Element>();
    constructor(
      readonly notify: (entries: IntersectionObserverEntry[]) => void,
      readonly options: IntersectionObserverInit & { scrollMargin?: string }
    ) {
      observers.add(this);
    }
    observe = (row: Element) => this.rows.add(row);
    unobserve = (row: Element) => this.rows.delete(row);
    disconnect = () => observers.delete(this);
  }
  vi.stubGlobal("IntersectionObserver", ColumnObserver);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  return (scrollTop: number, viewportHeight: number, measuredHeight = 144, scrollLeft = 0, viewportWidth = 688) => {
    act(() => {
      for (const { rows, notify, options } of observers) {
        const [marginY, marginX] = (options.scrollMargin ?? "0px 0px")
          .split(" ")
          .map((value) => Number.parseFloat(value));
        let top = -scrollTop;
        const entries = Array.from(rows, (row) => {
          const left = Number(row.parentElement?.dataset.left ?? 0) - scrollLeft;
          const inBoard = !!options.root || (left + 336 > -marginX && left < viewportWidth + marginX);
          const placeholder = row.firstElementChild as HTMLElement;
          const height = Number.parseFloat(placeholder.style.height) || measuredHeight;
          const isIntersecting = inBoard && top + height > -marginY && top < viewportHeight + marginY;
          top += height;
          return {
            target: row,
            isIntersecting,
            intersectionRatio: Number(isIntersecting),
            boundingClientRect: { height },
          };
        });
        notify(entries as IntersectionObserverEntry[]);
      }
      for (const [frame, callback] of frames) {
        frames.delete(frame);
        callback(performance.now());
      }
    });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mounted.mockClear();
});

it("keeps other boards and browsers without an observer eager", () => {
  const { rerender } = render(<KanbanIssueBlocksList {...listProps(50)} deferCards />);
  expect(screen.getAllByRole("article")).toHaveLength(50);
  viewport();
  rerender(<KanbanIssueBlocksList {...listProps(50)} />);
  expect(screen.getAllByRole("article")).toHaveLength(50);
});

it.each(["priority", "project"])(
  "paints visible %s cards before observers deliver the first eight results per column",
  (group) => {
    const scroll = viewport();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("horizontal-scrollbar")) return new DOMRect(0, 0, 688, 576);
      const left = Number(this.closest<HTMLElement>("[data-left]")?.dataset.left ?? 0);
      if (this.classList.contains("flow-root")) {
        const index = Array.from(this.parentElement!.children).indexOf(this);
        return new DOMRect(left, index * 144, 336, 144);
      }
      return new DOMRect(left, 0, 336, 576);
    });
    const columns = ["urgent", "high", "medium", "low", "none"].map((id, index) => {
      const cards = (
        <div className="vertical-scrollbar" data-left={index * 352}>
          <KanbanIssueBlocksList {...listProps(8, id)} columnId={id} deferCards />
        </div>
      );
      return (
        <div key={id} data-left={index * 352}>
          {group === "project" ? (
            <DeferredKanbanColumn name={id} className="w-[336px]">
              {cards}
            </DeferredKanbanColumn>
          ) : (
            cards
          )}
        </div>
      );
    });
    const board = <div className="horizontal-scrollbar">{columns}</div>;
    const { rerender } = render(board);
    expect(mounted.mock.calls.flat()).toEqual(["urgent-0", "urgent-1", "high-0", "high-1"]);
    scroll(0, 576);
    expect(mounted).toHaveBeenCalledTimes(16);
    expect(screen.getByRole("link", { name: "urgent-0" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "urgent-7" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "medium-0" })).toBeNull();
    rerender(<div />);
    rerender(board);
    expect(mounted).toHaveBeenCalledTimes(20);
    scroll(0, 576);
    expect(mounted).toHaveBeenCalledTimes(32);
    scroll(0, 576, 144, 3 * 352);
    // Project columns register their card observations after the column itself appears.
    if (group === "project") scroll(0, 576, 144, 3 * 352);
    expect(screen.getAllByRole("article")).toHaveLength(16);
    expect(screen.getByRole("link", { name: "none-0" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "urgent-0" })).toBeNull();
  }
);

it("bounds actual mounts by the viewport on tab return, scroll and page append", () => {
  const scroll = viewport();
  const root = createRef<HTMLDivElement>();
  const column = (count: number) => (
    <div ref={root}>
      <KanbanIssueBlocksList {...listProps(count)} deferCards />
      <span data-testid="next-page" />
    </div>
  );
  const { rerender } = render(column(146));
  expect(mounted).not.toHaveBeenCalled();
  scroll(0, 576);
  expect(mounted).toHaveBeenCalledTimes(8);
  rerender(<div />);
  rerender(column(146));
  expect(mounted).toHaveBeenCalledTimes(8);
  scroll(0, 576);
  expect(mounted).toHaveBeenCalledTimes(16);
  root.current!.scrollTop = 144 * 142;
  scroll(root.current!.scrollTop, 576);
  expect(screen.queryByRole("link", { name: "card-0" })).toBeNull();
  expect(screen.getByRole("link", { name: "card-145" })).toBeTruthy();
  const lastCard = screen.getByRole("link", { name: "card-145" });
  rerender(column(292));
  scroll(root.current!.scrollTop, 576);
  expect(screen.getByRole("link", { name: "card-145" })).toBe(lastCard);
  expect(screen.getAllByRole("article")).toHaveLength(12);
  expect(root.current!.scrollTop).toBe(144 * 142);
  expect(root.current!.lastElementChild).toBe(screen.getByTestId("next-page"));
  expect(document.getElementById("issue-card-291")?.style.height).toBe("144px");
  scroll(root.current!.scrollTop, 288);
  expect(screen.getAllByRole("article")).toHaveLength(10);
});

it("keeps the title visible during a fast scroll and activates the card on pointer entry", () => {
  viewport();
  render(<KanbanIssueBlocksList {...listProps(146)} deferCards />);
  const preview = document.getElementById("issue-card-80")!;
  expect(preview.textContent).toContain("card-80");
  expect(screen.queryByRole("link", { name: "card-80" })).toBeNull();
  fireEvent.pointerEnter(preview);
  expect(screen.getByRole("link", { name: "card-80" })).toBeTruthy();
});

it("preserves measured row height when recycling a wrapped card", () => {
  const scroll = viewport();
  render(<KanbanIssueBlocksList {...listProps(146)} deferCards />);
  scroll(0, 576);
  scroll(2000, 576, 223);
  expect(document.getElementById("issue-card-0")?.style.height).toBe("223px");
});

it("moves keyboard focus into a deferred card and keeps its editor across scrolling and portal focus", () => {
  const scroll = viewport();
  render(
    <>
      <KanbanIssueBlocksList {...listProps(146)} deferCards />
      <button type="button">Popup</button>
    </>
  );
  act(() => screen.getByRole("button", { name: "card-80" }).focus());
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "card-80" }));
  const editor = screen.getByRole("textbox", { name: "Edit card-80" });
  act(() => editor.focus());
  fireEvent.change(editor, { target: { value: "draft" } });
  scroll(0, 576);
  expect(document.activeElement).toBe(editor);
  act(() => screen.getByRole("button", { name: "Popup" }).focus());
  expect(screen.getByDisplayValue("draft")).toBe(editor);
  fireEvent.pointerDown(screen.getByRole("link", { name: "card-1" }));
  expect(screen.queryByDisplayValue("draft")).toBeNull();
});

it("keeps an offscreen drag preview mounted at its full-list index with its source sortable id", () => {
  const scroll = viewport();
  const props = listProps(146);
  const { rerender } = render(
    <KanbanIssueBlocksList {...props} deferCards activeIssueId="card-145" activeSourceColumnId="other" />
  );
  scroll(0, 576);
  const preview = screen.getByRole("link", { name: "card-145" }).closest("article");
  expect(preview?.dataset.index).toBe("145");
  expect(preview?.dataset.sortable).toBe("card-145__other");
  rerender(<KanbanIssueBlocksList {...props} deferCards />);
  expect(screen.queryByRole("link", { name: "card-145" })).toBeNull();
  expect(document.getElementById(getIssueBlockId("card-145", "priority", "null"))).toBeTruthy();
});
