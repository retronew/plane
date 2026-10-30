import { describe, expect, it } from "vitest";
import {
  getKanbanDragTiltTarget,
  getKanbanDropDestination,
  moveIssueInOrder,
  stepKanbanDragTilt,
} from "./kanban-dnd-utils";

const board = () => ({ todo: ["a", "b", "c"], doing: ["x", "y"], done: [] as string[] });

describe("moveIssueInOrder", () => {
  it("moves a card down past the card it hovers, and up in front of it", () => {
    expect(moveIssueInOrder(board(), "a", "todo", { columnId: "todo", overIssueId: "b" }).todo).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(moveIssueInOrder(board(), "c", "todo", { columnId: "todo", overIssueId: "a" }).todo).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("moves a card into another column in front of the hovered card, or to the end of the column", () => {
    const before = moveIssueInOrder(board(), "a", "todo", { columnId: "doing", overIssueId: "y" });
    expect(before.todo).toEqual(["b", "c"]);
    expect(before.doing).toEqual(["x", "a", "y"]);
    expect(moveIssueInOrder(board(), "a", "todo", { columnId: "done" }).done).toEqual(["a"]);
  });

  it("returns the same order when nothing moves, so React can bail out", () => {
    const order = board();
    expect(moveIssueInOrder(order, "a", "todo", { columnId: "todo" })).toBe(order);
    expect(moveIssueInOrder(order, "a", "todo", { columnId: "todo", overIssueId: "a" })).toBe(order);
    // the card isn't where the caller says it is
    expect(moveIssueInOrder(order, "a", "doing", { columnId: "done" })).toBe(order);
    // already listed in the target column (multi-value grouping)
    const multi = { todo: ["a"], doing: ["a", "x"] };
    expect(moveIssueInOrder(multi, "a", "todo", { columnId: "doing", overIssueId: "x" })).toBe(multi);
  });
});

describe("getKanbanDropDestination", () => {
  const column = { columnId: "doing", groupId: "doing", subGroupId: "null", canReorder: true };

  it("anchors before the card that follows, or after the last card", () => {
    expect(getKanbanDropDestination({ doing: ["x", "a", "y"] }, "a", column)).toMatchObject({
      id: "y",
      insertAfter: false,
    });
    expect(getKanbanDropDestination({ doing: ["x", "y", "a"] }, "a", column)).toMatchObject({
      id: "y",
      insertAfter: true,
    });
  });

  it("drops into an empty column, or a column that can't be reordered, without an anchor", () => {
    expect(getKanbanDropDestination({ doing: ["a"] }, "a", column)).toMatchObject({
      id: undefined,
      insertAfter: false,
    });
    expect(getKanbanDropDestination({ doing: ["x", "a"] }, "a", { ...column, canReorder: false })).toMatchObject({
      columnId: "doing",
      groupId: "doing",
      subGroupId: "null",
      id: undefined,
    });
  });
});

describe("getKanbanDragTiltTarget", () => {
  it("trails the motion: moving right lifts the right side, moving left the left side", () => {
    expect(getKanbanDragTiltTarget(1)).toBeCloseTo(-2.5);
    expect(getKanbanDragTiltTarget(-1)).toBeCloseTo(2.5);
  });

  it("is level at rest and never leans past the cap on a fling", () => {
    expect(getKanbanDragTiltTarget(0)).toBe(0);
    expect(getKanbanDragTiltTarget(10)).toBe(-3);
    expect(getKanbanDragTiltTarget(-10)).toBe(3);
  });
});

describe("stepKanbanDragTilt", () => {
  it("eases part of the way toward the target each frame", () => {
    const next = stepKanbanDragTilt(0, -3, 16);
    expect(next).toBeLessThan(0);
    expect(next).toBeGreaterThan(-1);
  });

  it("settles on the target once close, and holds still without elapsed time", () => {
    expect(stepKanbanDragTilt(-2.99, -3, 16)).toBe(-3);
    expect(stepKanbanDragTilt(-1, -3, 0)).toBe(-1);
  });
});
