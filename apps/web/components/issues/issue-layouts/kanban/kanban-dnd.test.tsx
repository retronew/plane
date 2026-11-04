import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KanbanDndProvider, useKanbanColumnDnd } from "./kanban-dnd";

type DragEvent = {
  canceled?: boolean;
  preventDefault: () => void;
  operation: {
    source: { data: { kind: string; issueId: string; columnId: string } };
    target: { id: string; data: { kind: string; columnId: string } };
    position: { current: { x: number } };
  };
};
const state = vi.hoisted(() => ({ handlers: {} as Record<string, (event: DragEvent) => void> }));
vi.mock("@/hooks/store/use-kanban-view", () => ({ useKanbanView: () => ({ setIsDragging: vi.fn() }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("../utils", () => ({ getIssueBlockId: vi.fn() }));
vi.mock("@dnd-kit/dom", () => ({
  AutoScroller: { configure: vi.fn() },
  KeyboardSensor: {},
  PointerSensor: { configure: vi.fn() },
  PointerActivationConstraints: { Delay: vi.fn(), Distance: vi.fn() },
}));
vi.mock("@dnd-kit/react/sortable", () => ({ useSortable: vi.fn() }));
vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({
    children,
    ...handlers
  }: {
    children: ReactNode;
    onDragStart: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragEnd: (event: DragEvent) => void;
  }) => {
    Object.assign(state.handlers, handlers);
    return children;
  },
  useDroppable: () => ({ ref: vi.fn() }),
}));
const sourceIds = ["issue"];
const emptyIds: string[] = [];
function Column({ id, ids }: { id: string; ids: string[] }) {
  const column = useKanbanColumnDnd({
    columnId: id,
    groupId: id,
    subGroupId: "",
    issueIds: ids,
    canReorder: true,
    getDropError: () => undefined,
  });
  return <div data-testid={id}>{column.issueIds.join(",")}</div>;
}

it.each(["confirm", "cancel"] as const)(
  "keeps the original column while awaiting confirmation, then handles %s",
  async (action) => {
    function Board() {
      const [saved, setSaved] = useState(false);
      const [resolveDrop, setResolveDrop] = useState<(() => void) | null>(null);
      return (
        <>
          <button
            onClick={() => {
              setSaved(true);
              resolveDrop?.();
            }}
          >
            confirm
          </button>
          <button
            onClick={() => {
              resolveDrop?.();
            }}
          >
            cancel
          </button>
          <KanbanDndProvider
            orderBy="sort_order"
            onRequestDelete={vi.fn()}
            handleOnDrop={(_source, _destination, beforeConfirmation) => {
              beforeConfirmation?.();
              return new Promise<void>((resolve) => setResolveDrop(() => resolve));
            }}
          >
            <Column id="a" ids={saved ? emptyIds : sourceIds} />
            <Column id="b" ids={saved ? sourceIds : emptyIds} />
          </KanbanDndProvider>
        </>
      );
    }
    render(<Board />);
    const event: DragEvent = {
      preventDefault: vi.fn(),
      operation: {
        source: { data: { kind: "card", issueId: "issue", columnId: "a" } },
        target: { id: "b", data: { kind: "column", columnId: "b" } },
        position: { current: { x: 10 } },
      },
    };
    act(() => state.handlers.onDragStart(event));
    act(() => state.handlers.onDragOver(event));
    expect(screen.getByTestId("a").textContent).toBe("");
    expect(screen.getByTestId("b").textContent).toBe("issue");
    act(() => state.handlers.onDragEnd(event));
    expect(screen.getByTestId("a").textContent).toBe("issue");
    expect(screen.getByTestId("b").textContent).toBe("");
    await act(async () => fireEvent.click(screen.getByText(action)));
    expect(screen.getByTestId("a").textContent).toBe(action === "confirm" ? "" : "issue");
    expect(screen.getByTestId("b").textContent).toBe(action === "confirm" ? "issue" : "");
  }
);
