import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { TIssue } from "@plane/types";
import { GroupDragOverlay } from "./group-drag-overlay";
import type { GroupDropLocation } from "./utils";
import { getDestinationFromDropPayload, handleGroupDragDrop } from "./utils";

vi.mock("@plane/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/i18n")>()),
  useTranslation: () => ({
    t: (key: string) =>
      ({ "issue.layouts.ordered_by_label": "此布局的排序方式为", "common.created_at": "创建时间" })[key] ?? key,
  }),
}));

const issues: Record<string, TIssue> = {
  a: { id: "a", project_id: "p", sort_order: 100, state_id: "todo" } as TIssue,
  b: { id: "b", project_id: "p", sort_order: 200, state_id: "todo" } as TIssue,
  c: { id: "c", project_id: "p", sort_order: 300, state_id: "todo" } as TIssue,
  x: { id: "x", project_id: "p", sort_order: 50, state_id: "done" } as TIssue,
};

const dropOn = async (destination: GroupDropLocation) => {
  const update = vi.fn();
  await handleGroupDragDrop(
    { id: "x", groupId: "done", columnId: "done__null" },
    destination,
    (id) => issues[id],
    () => ["a", "b", "c"],
    update,
    "state",
    undefined
  );
  return update.mock.calls[0][2] as Partial<TIssue>;
};

describe("kanban drop position", () => {
  const column = { groupId: "todo", columnId: "todo__null" };

  it("inserts before a card when dropped on its top edge", async () => {
    expect((await dropOn({ ...column, id: "b" })).sort_order).toBe(150);
  });

  it("inserts after a card when dropped on its bottom edge", async () => {
    expect((await dropOn({ ...column, id: "a", insertAfter: true })).sort_order).toBe(150);
    expect((await dropOn({ ...column, id: "c", insertAfter: true })).sort_order).toBe(300 + 65535);
  });

  it("reads the closest edge from the hovered card", () => {
    const rect = { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect;
    const element = { getBoundingClientRect: () => rect } as unknown as Element;
    const input = { clientX: 50, clientY: 90 } as Parameters<typeof attachClosestEdge>[1]["input"];
    const cardData = attachClosestEdge({ id: "a", type: "ISSUE" }, { input, element, allowedEdges: ["top", "bottom"] });
    const payload = {
      source: { data: { id: "x" } },
      location: { current: { dropTargets: [{ data: cardData }, { data: { ...column, type: "COLUMN" } }] } },
    } as unknown as Parameters<typeof getDestinationFromDropPayload>[0];

    expect(getDestinationFromDropPayload(payload)).toMatchObject({ id: "a", groupId: "todo", insertAfter: true });
  });
});

describe("GroupDragOverlay", () => {
  const props = {
    dragColumnOrientation: "justify-center" as const,
    canOverlayBeVisible: true,
    isDropDisabled: false,
    orderBy: "-created_at" as const,
    isDraggingOverColumn: true,
  };

  it("shows a single localized ordering hint without blocking pointer events", () => {
    render(<GroupDragOverlay {...props} />);
    const overlay = screen.getByTestId("group-drag-overlay");
    expect(overlay.textContent).not.toContain("work item");
    expect(overlay.className).toContain("pointer-events-none");
  });

  it("renders nothing when the column isn't hovered", () => {
    render(<GroupDragOverlay {...props} isDraggingOverColumn={false} />);
    expect(screen.queryByTestId("group-drag-overlay")).toBeNull();
  });
});
