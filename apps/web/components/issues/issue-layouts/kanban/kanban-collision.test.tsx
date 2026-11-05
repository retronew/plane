import { DOMRectangle } from "@dnd-kit/dom/utilities";
import type { CollisionDetector } from "@dnd-kit/collision";
import { afterEach, describe, expect, it, vi } from "vitest";
import { kanbanCollisionDetection } from "./kanban-collision";

vi.hoisted(() => {
  Object.defineProperty(document, "getAnimations", { value: () => [], configurable: true });
  Object.defineProperty(Element.prototype, "getAnimations", { value: () => [], configurable: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

type CollisionInput = Parameters<CollisionDetector>[0];

function rectangle(x: number, y: number, width: number, height: number, id?: string) {
  const element = document.createElement("div");
  if (id) element.id = id;
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(x, y, width, height));
  document.body.append(element);
  return new DOMRectangle(element);
}

function collision(centerX: number, pointerX: number, columnId = "right", card = false, pointerY = 50) {
  const target = card
    ? rectangle(330, 20, 280, 100)
    : columnId === "left"
      ? rectangle(0, 0, 320, 600)
      : rectangle(320, 0, 300, 600);
  return kanbanCollisionDetection({
    droppable: {
      id: card ? "target-card" : columnId,
      data: { columnId, kind: card ? "card" : "column" },
      shape: target,
    },
    dragOperation: {
      shape: { current: rectangle(centerX - 140, 20, 280, 100) },
      position: { current: { x: pointerX, y: pointerY } },
    },
  } as unknown as CollisionInput);
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("kanban horizontal midpoint collision", () => {
  it.each([false, true])("does not switch early when the pointer enters a target (card=%s)", (card) => {
    rectangle(320, 0, 300, 600, "right");
    expect(collision(319, 450, "right", card)).toBeNull();
  });

  it.each([false, true])("switches after half the card enters even if the pointer stays outside (card=%s)", (card) => {
    rectangle(320, 0, 300, 600, "right");
    expect(collision(321, 200, "right", card)?.id).toBe(card ? "target-card" : "right");
  });

  it.each([190, 330, 460])("keeps the same target for horizontal grab position %s", (pointerX) => {
    rectangle(320, 0, 300, 600, "right");
    expect(collision(330, pointerX)?.id).toBe("right");
  });

  it("assigns a shared boundary to only one column", () => {
    rectangle(0, 0, 320, 600, "left");
    rectangle(320, 0, 300, 600, "right");
    expect(collision(320, 200, "left")).toBeNull();
    expect(collision(320, 200, "right")?.id).toBe("right");
  });

  it("switches back to the left only once the card midpoint crosses back", () => {
    rectangle(0, 0, 320, 600, "left");
    rectangle(320, 0, 300, 600, "right");
    expect(collision(321, 190, "left")).toBeNull();
    expect(collision(319, 450, "left")?.id).toBe("left");
  });

  it("retains vertical hit testing and supports empty column tails", () => {
    rectangle(320, 0, 300, 600, "right");
    expect(collision(470, 470, "right", false, 500)?.id).toBe("right");
    expect(collision(470, 470, "right", true, 500)?.id).toBe("target-card");
  });

  it("ignores a column that has unmounted", () => {
    expect(collision(330, 330)).toBeNull();
  });
});
