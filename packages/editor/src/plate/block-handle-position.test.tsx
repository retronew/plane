import { afterEach, expect, it, vi } from "vitest";
import { observeBlockHandlePosition } from "./block-handle-position";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it.each([24, 48, 72])("keeps the handle outside a task checkbox at indent %s", (indent) => {
  const parent = document.createElement("div");
  parent.innerHTML =
    '<div><button class="comparison-drag-handle"></button><div class="comparison-drop-gap-before"></div><div data-type="taskItem"><span contenteditable="false"><button role="checkbox"></button></span><span><span data-slate-string>Wrapped task</span></span></div></div>';
  document.body.append(parent);
  const node = parent.firstElementChild as HTMLElement;
  const handle = node.firstElementChild as HTMLElement;
  const row = node.querySelector<HTMLElement>('[data-type="taskItem"]')!;
  const text = node.querySelector<HTMLElement>("[data-slate-string]")!;
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect(100, 50, 600, 100));
  vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(100 + indent, 60, 500, 48));
  vi.spyOn(text, "getClientRects").mockReturnValue([rect(124 + indent, 62, 300, 24)] as unknown as DOMRectList);
  const dispose = observeBlockHandlePosition(node, handle);
  // A 16px handle ends 4px before the task row/checkbox and remains on the first text line.
  expect(Number.parseFloat(handle.style.left) + 16).toBe(indent - 4);
  expect(handle.style.top).toBe("16px");
  dispose?.();
});

it("preserves aligned paragraph positioning", () => {
  const parent = document.createElement("div");
  parent.innerHTML =
    '<div><button></button><div class="comparison-drop-gap-before"></div><p><span data-slate-string>Aligned</span></p></div>';
  document.body.append(parent);
  const node = parent.firstElementChild as HTMLElement;
  const handle = node.firstElementChild as HTMLElement;
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect(100, 50, 600, 100));
  vi.spyOn(node.querySelector("span")!, "getClientRects").mockReturnValue([
    rect(320, 90, 180, 24),
  ] as unknown as DOMRectList);
  const dispose = observeBlockHandlePosition(node, handle);
  expect(handle.style.left).toBe("200px");
  expect(handle.style.top).toBe("44px");
  dispose?.();
});
